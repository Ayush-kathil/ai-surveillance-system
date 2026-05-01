from fastapi import FastAPI, File, Form, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import os
import shutil
import tempfile
import subprocess
import asyncio
import csv
import json
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from pydantic import BaseModel
from celery.result import AsyncResult
from engine import warm_up_models, yield_raw_video_frames
from tasks import analyze_surveillance_task, celery_app
from logger_config import logger
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.bind(event="startup").info("Pre-loading AI models")
    try:
        warm_up_models()
        logger.bind(event="startup").info("AI models loaded successfully")
    except Exception as e:
        logger.bind(event="startup", error=str(e)).error("Model pre-loading warning")
    yield
    logger.bind(event="shutdown").info("FastAPI lifespan shutdown completed")

app = FastAPI(title="Surveillance Analysis API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import uuid

app.state.sessions = {}
SHARED_SESSIONS_DIR = Path(os.getenv("SHARED_SESSIONS_DIR", ""))
SNAPSHOT_DIR = Path(os.getenv("MATCH_SNAPSHOT_DIR", "output/snapshots"))


def _build_session_workdir(session_id: str) -> Path:
    if SHARED_SESSIONS_DIR:
        session_root = SHARED_SESSIONS_DIR / session_id
        session_root.mkdir(parents=True, exist_ok=True)
        return session_root
    return Path(tempfile.mkdtemp(prefix=f"session_{session_id}_"))


def _save_uploaded_file(upload: UploadFile, destination: Path) -> int:
    # Use a larger copy chunk to reduce overhead for large video files.
    upload.file.seek(0)
    with open(destination, "wb") as buffer:
        shutil.copyfileobj(upload.file, buffer, length=8 * 1024 * 1024)
    return int(destination.stat().st_size)


def _session_task(session_id: str) -> AsyncResult | None:
    session = app.state.sessions.get(session_id)
    if not session:
        return None
    task_id = session.get("task_id")
    if not task_id:
        return None
    return AsyncResult(task_id, app=celery_app)


def _task_payload(session_id: str) -> dict[str, Any]:
    session = app.state.sessions.get(session_id)
    if not session:
        return {
            "state": "not_found",
            "progress_percent": 0,
            "processed_frames": 0,
            "total_frames": 1,
            "alerts_count": 0,
            "alerts": [],
            "latest_boxes": {"CAM-1": None, "CAM-2": None},
            "error": "Session not found",
        }

    task = _session_task(session_id)
    if task is None:
        return {
            "state": "pending",
            "progress_percent": 0,
            "processed_frames": 0,
            "total_frames": 1,
            "alerts_count": 0,
            "alerts": [],
            "latest_boxes": {"CAM-1": None, "CAM-2": None},
            "error": None,
        }

    try:
        state = str(task.state or "PENDING").lower()
        task_info = task.info
    except Exception as exc:
        logger.bind(event="task_meta_decode_failed", session_id=session_id, error=str(exc)).warning(
            "Failed to decode task metadata"
        )
        return {
            "state": "failed",
            "progress_percent": 0,
            "processed_frames": 0,
            "total_frames": 1,
            "alerts_count": 0,
            "alerts": [],
            "latest_boxes": {"CAM-1": None, "CAM-2": None},
            "profile": session.get("profile", "balanced"),
            "current_camera": "CAM-1",
            "error": f"Task metadata unavailable: {exc}",
        }

    info = task_info if isinstance(task_info, dict) else {}

    payload: dict[str, Any] = {
        "state": state,
        "progress_percent": int(info.get("progress_percent") or 0),
        "processed_frames": int(info.get("processed_frames") or 0),
        "total_frames": max(1, int(info.get("total_frames") or 1)),
        "alerts_count": int(info.get("alerts_count") or 0),
        "latest_boxes": info.get("latest_boxes") or {"CAM-1": None, "CAM-2": None},
        "profile": session.get("profile", "balanced"),
        "current_camera": info.get("current_camera", "CAM-1"),
        "error": info.get("error"),
        "alerts": info.get("alerts") or [],
    }

    if task.successful():
        try:
            task_result = task.result
        except Exception as exc:
            logger.bind(event="task_result_decode_failed", session_id=session_id, error=str(exc)).warning(
                "Failed to decode task result"
            )
            task_result = {}
        result = task_result if isinstance(task_result, dict) else {}
        payload.update(
            {
                "state": str(result.get("state") or "completed"),
                "progress_percent": int(result.get("progress_percent") or 100),
                "processed_frames": int(result.get("processed_frames") or payload["processed_frames"]),
                "total_frames": max(1, int(result.get("total_frames") or payload["total_frames"])),
                "alerts_count": int(result.get("alerts_count") or 0),
                "alerts": result.get("alerts") or [],
                "profile": result.get("profile") or payload["profile"],
                "error": None,
            }
        )
    elif task.failed():
        payload["state"] = "failed"
        try:
            payload["error"] = str(task.result)
        except Exception as exc:
            payload["error"] = f"Task failed and result could not be decoded: {exc}"

    return payload

@app.post("/api/analyze")
async def analyze_surveillance(
    missing_image: UploadFile = File(...),
    cam1_video: UploadFile = File(...),
    cam2_video: UploadFile = File(...),
    profile: str = Form("balanced"),
):
    try:
        img_bytes = await missing_image.read()
        if not img_bytes:
            raise HTTPException(status_code=400, detail="Reference image is empty.")

        session_id = str(uuid.uuid4())
        temp_dir = _build_session_workdir(session_id)
        cam1_path = str(temp_dir / "cam1.mp4")
        cam2_path = str(temp_dir / "cam2.mp4")
        reference_filename = Path(missing_image.filename or "reference.jpg").name
        reference_path = str(temp_dir / reference_filename)
        with open(reference_path, "wb") as reference_buffer:
            reference_buffer.write(img_bytes)

        cam1_size, cam2_size = await asyncio.gather(
            asyncio.to_thread(_save_uploaded_file, cam1_video, Path(cam1_path)),
            asyncio.to_thread(_save_uploaded_file, cam2_video, Path(cam2_path)),
        )

        normalized_profile = profile.strip().lower() if profile else "balanced"
        if normalized_profile not in {"fast", "balanced", "accurate"}:
            normalized_profile = "balanced"

        task = analyze_surveillance_task.delay(
            session_id=session_id,
            cam1_path=cam1_path,
            cam2_path=cam2_path,
            reference_image_path=reference_path,
            profile=normalized_profile,
        )

        app.state.sessions[session_id] = {
            "CAM-1": cam1_path,
            "CAM-2": cam2_path,
            "reference": reference_path,
            "profile": normalized_profile,
            "task_id": task.id,
            "created_at": datetime.utcnow().isoformat(),
            "cam1_size": cam1_size,
            "cam2_size": cam2_size,
        }
        logger.bind(event="session_created", session_id=session_id, profile=normalized_profile).info(
            "Session created and task queued"
        )
        
        return {
            "status": "success",
            "session_id": session_id,
            "profile": normalized_profile,
            "task_id": task.id,
            "job_state": "pending",
        }

    except Exception as e:
        logger.bind(event="session_create_failed", error=str(e)).exception("Session creation failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream/{session_id}/{cam_id}")
async def stream_video(session_id: str, cam_id: str):
    if session_id not in app.state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if cam_id not in ["CAM-1", "CAM-2"]:
        raise HTTPException(status_code=404, detail="Invalid camera ID")
        
    video_path = app.state.sessions[session_id][cam_id]
    
    return StreamingResponse(
        yield_raw_video_frames(video_path),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/api/alerts/{session_id}")
def get_alerts(session_id: str):
    payload = _task_payload(session_id)
    return {
        "alerts": payload.get("alerts", []),
        "job_state": payload.get("state", "pending"),
        "profile": payload.get("profile", "balanced"),
        "latest_boxes": payload.get("latest_boxes", {"CAM-1": None, "CAM-2": None}),
    }


@app.get("/api/progress/{session_id}")
def get_progress(session_id: str):
    payload = _task_payload(session_id)
    return {
        "state": payload.get("state", "pending"),
        "progress_percent": payload.get("progress_percent", 0),
        "processed_frames": payload.get("processed_frames", 0),
        "total_frames": payload.get("total_frames", 1),
        "current_camera": payload.get("current_camera", "CAM-1"),
        "alerts_count": payload.get("alerts_count", 0),
        "profile": payload.get("profile", "balanced"),
        "error": payload.get("error"),
        "latest_boxes": payload.get("latest_boxes", {"CAM-1": None, "CAM-2": None}),
    }


@app.websocket("/ws/session/{session_id}")
async def session_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            payload = _task_payload(session_id)
            await websocket.send_json(payload)
            state = str(payload.get("state", "pending")).lower()
            if state in {"completed", "failed", "error", "not_found"}:
                break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011)


@app.get("/api/snapshots/{session_id}/{filename}")
def get_snapshot(session_id: str, filename: str):
    if session_id not in app.state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    safe_filename = Path(filename).name
    snapshot_path = Path(__file__).resolve().parent / "output" / "snapshots" / safe_filename

    if not snapshot_path.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return FileResponse(snapshot_path, media_type="image/jpeg", filename=safe_filename)


@app.get("/api/export/{session_id}")
async def export_session_artifacts(session_id: str):
    session = app.state.sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    payload = _task_payload(session_id)
    state = str(payload.get("state") or "pending").lower()
    if state not in {"completed", "failed", "error"}:
        raise HTTPException(status_code=409, detail="Session export is available after analysis finishes")

    alerts = payload.get("alerts") or []
    export_path = Path(tempfile.gettempdir()) / f"evidence_{session_id}.zip"
    alerts_json = json.dumps(alerts, indent=2)

    alerts_csv_rows: list[dict[str, Any]] = []
    for alert in alerts:
        alerts_csv_rows.append(
            {
                "timestamp": alert.get("timestamp", ""),
                "camera": alert.get("camera", ""),
                "confidence_score": alert.get("score", ""),
                "video_timestamp": alert.get("video_timestamp", ""),
                "track_id": alert.get("track_id", ""),
            }
        )

    csv_file = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    csv_path = Path(csv_file.name)
    csv_file.close()
    with open(csv_path, "w", newline="", encoding="utf-8") as csv_buffer:
        writer = csv.DictWriter(
            csv_buffer,
            fieldnames=["timestamp", "camera", "confidence_score", "video_timestamp", "track_id"],
        )
        writer.writeheader()
        writer.writerows(alerts_csv_rows)

    with zipfile.ZipFile(export_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_buffer:
        reference_path = Path(str(session.get("reference") or ""))
        if reference_path.exists() and reference_path.is_file():
            zip_buffer.write(reference_path, arcname=f"reference/{reference_path.name}")

        zip_buffer.writestr("alerts/alerts.json", alerts_json)
        zip_buffer.write(csv_path, arcname="alerts/alerts.csv")

        for alert in alerts:
            snapshot_name = Path(str(alert.get("snapshot") or "")).name
            if not snapshot_name:
                continue
            snapshot_path = SNAPSHOT_DIR / snapshot_name
            if snapshot_path.exists() and snapshot_path.is_file():
                zip_buffer.write(snapshot_path, arcname=f"snapshots/{snapshot_name}")

    try:
        csv_path.unlink(missing_ok=True)
    except Exception:
        pass

    logger.bind(event="session_export", session_id=session_id, alert_count=len(alerts)).info(
        "Evidence export generated"
    )
    return FileResponse(
        path=export_path,
        media_type="application/zip",
        filename=f"evidence_{session_id}.zip",
    )

@app.get("/health")
def read_root():
    return {"status": "Online"}


class ResetRequest(BaseModel):
    session_id: str | None = None
    prune_outputs: bool = True


@app.post("/api/system/reset-workspace")
async def reset_workspace(payload: ResetRequest):
    if payload.session_id:
        session = app.state.sessions.get(payload.session_id)
        task_id = session.get("task_id") if session else None
        if task_id:
            celery_app.control.revoke(task_id, terminate=True)
        app.state.sessions.pop(payload.session_id, None)
    else:
        for session in list(app.state.sessions.values()):
            task_id = session.get("task_id")
            if task_id:
                celery_app.control.revoke(task_id, terminate=True)
        app.state.sessions.clear()

    workspace_root = Path(__file__).resolve().parents[1]
    cleanup_script = workspace_root / "scripts" / "cleanup_workspace.ps1"
    if not cleanup_script.exists():
        raise HTTPException(status_code=500, detail="Cleanup script not found")

    command = [
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(cleanup_script),
        "-SkipLegacyArchive",
    ]
    if payload.prune_outputs:
        command.append("-PruneOutputs")

    try:
        result = await asyncio.to_thread(
            subprocess.run,
            command,
            cwd=str(workspace_root),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Cleanup timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {e}")

    if result.returncode != 0:
        error_text = (result.stderr or result.stdout or "Cleanup script exited with errors").strip()
        raise HTTPException(status_code=500, detail=error_text)

    return {
        "status": "success",
        "message": "Workspace reset completed.",
        "output": (result.stdout or "").strip(),
    }
