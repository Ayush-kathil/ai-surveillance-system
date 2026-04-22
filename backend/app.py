from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import tempfile
import subprocess
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any
from pydantic import BaseModel
from celery.result import AsyncResult
from engine import load_encoding_from_image, warm_up_models, yield_raw_video_frames
from tasks import analyze_surveillance_task, celery_app
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-load models
    print("Pre-loading AI Models (YOLOv12, FaceNet)...")
    try:
        warm_up_models()
        print("AI Models loaded successfully.")
    except Exception as e:
        print(f"Model pre-loading warning: {e}")
    yield
    # Shutdown: Clean up if needed
    pass

app = FastAPI(title="Surveillance Analysis API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import uuid
from fastapi.responses import FileResponse, StreamingResponse

app.state.sessions = {}
SHARED_SESSIONS_DIR = Path(os.getenv("SHARED_SESSIONS_DIR", ""))


def _build_session_workdir(session_id: str) -> Path:
    if SHARED_SESSIONS_DIR:
        session_root = SHARED_SESSIONS_DIR / session_id
        session_root.mkdir(parents=True, exist_ok=True)
        return session_root
    return Path(tempfile.mkdtemp(prefix=f"session_{session_id}_"))


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

    info = task.info if isinstance(task.info, dict) else {}
    state = str(task.state or "PENDING").lower()

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
        result = task.result if isinstance(task.result, dict) else {}
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
        payload["error"] = str(task.result)

    return payload

@app.post("/api/analyze")
async def analyze_surveillance(
    missing_image: UploadFile = File(...),
    cam1_video: UploadFile = File(...),
    cam2_video: UploadFile = File(...),
    profile: str = "balanced",
):
    try:
        img_bytes = await missing_image.read()
        try:
            target_encoding = load_encoding_from_image(img_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        session_id = str(uuid.uuid4())
        temp_dir = _build_session_workdir(session_id)
        cam1_path = str(temp_dir / "cam1.mp4")
        cam2_path = str(temp_dir / "cam2.mp4")

        with open(cam1_path, "wb") as buffer:
            shutil.copyfileobj(cam1_video.file, buffer)
        with open(cam2_path, "wb") as buffer:
            shutil.copyfileobj(cam2_video.file, buffer)

        normalized_profile = profile.strip().lower() if profile else "balanced"
        if normalized_profile not in {"fast", "balanced", "accurate"}:
            normalized_profile = "balanced"

        task = analyze_surveillance_task.delay(
            session_id=session_id,
            cam1_path=cam1_path,
            cam2_path=cam2_path,
            target_encoding=target_encoding.tolist(),
            profile=normalized_profile,
        )

        app.state.sessions[session_id] = {
            "CAM-1": cam1_path,
            "CAM-2": cam2_path,
            "profile": normalized_profile,
            "task_id": task.id,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        return {
            "status": "success",
            "session_id": session_id,
            "profile": normalized_profile,
            "task_id": task.id,
            "job_state": "pending",
        }

    except Exception as e:
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
