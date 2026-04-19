from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import tempfile
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel
from engine import load_encoding_from_image, warm_up_models, analyze_video_alerts, yield_raw_video_frames
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
import asyncio

app.state.sessions = {}
app.state.session_tasks = {}


async def _run_session_analysis(session_id: str):
    session = app.state.sessions.get(session_id)
    if not session:
        return

    try:
        session["job"]["state"] = "running"
        session["job"]["started_at"] = datetime.utcnow().isoformat()

        cam1_path = session["CAM-1"]
        cam2_path = session["CAM-2"]

        import cv2

        cap1 = cv2.VideoCapture(cam1_path)
        cap2 = cv2.VideoCapture(cam2_path)
        cam1_total = int(cap1.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        cam2_total = int(cap2.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        cap1.release()
        cap2.release()

        total_frames = max(1, cam1_total + cam2_total)
        session["job"]["total_frames"] = total_frames
        session["job"]["processed_frames"] = 0
        session["job"]["progress_percent"] = 0
        session["job"]["current_camera"] = "CAM-1"

        lock = threading.Lock()
        profile = session.get("profile", "balanced")

        async def run_camera(camera_id: str, path: str):
            await asyncio.to_thread(
                analyze_video_alerts,
                path,
                camera_id,
                session["target_encoding"],
                session["alerts"],
                profile=profile,
                progress=session["job"],
                progress_lock=lock,
            )

        await asyncio.gather(
            run_camera("CAM-1", cam1_path),
            run_camera("CAM-2", cam2_path),
        )

        session["alerts"].sort(key=lambda alert: (alert.get("timestamp", ""), alert.get("camera", "")))
        session["job"]["processed_frames"] = total_frames
        session["job"]["progress_percent"] = 100
        session["job"]["state"] = "completed"
        session["job"]["completed_at"] = datetime.utcnow().isoformat()
    except Exception as exc:
        session["job"]["state"] = "failed"
        session["job"]["error"] = str(exc)
    finally:
        app.state.session_tasks.pop(session_id, None)

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

        temp_dir = tempfile.mkdtemp()
        cam1_path = os.path.join(temp_dir, "cam1.mp4")
        cam2_path = os.path.join(temp_dir, "cam2.mp4")

        with open(cam1_path, "wb") as buffer:
            shutil.copyfileobj(cam1_video.file, buffer)
        with open(cam2_path, "wb") as buffer:
            shutil.copyfileobj(cam2_video.file, buffer)

        session_id = str(uuid.uuid4())
        normalized_profile = profile.strip().lower() if profile else "balanced"
        if normalized_profile not in {"fast", "balanced", "accurate"}:
            normalized_profile = "balanced"

        app.state.sessions[session_id] = {
            "target_encoding": target_encoding,
            "CAM-1": cam1_path,
            "CAM-2": cam2_path,
            "alerts": [],
            "profile": normalized_profile,
            "job": {
                "state": "pending",
                "progress_percent": 0,
                "processed_frames": 0,
                "total_frames": 1,
                "current_camera": "CAM-1",
                "error": None,
                "started_at": None,
                "completed_at": None,
            },
        }

        task = asyncio.create_task(_run_session_analysis(session_id))
        app.state.session_tasks[session_id] = task
        
        return {
            "status": "success",
            "session_id": session_id,
            "profile": normalized_profile,
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
    if session_id not in app.state.sessions:
        return {"alerts": []}
    session = app.state.sessions[session_id]
    return {
        "alerts": session["alerts"],
        "job_state": session.get("job", {}).get("state", "pending"),
        "profile": session.get("profile", "balanced"),
    }


@app.get("/api/progress/{session_id}")
def get_progress(session_id: str):
    if session_id not in app.state.sessions:
        return {
            "state": "not_found",
            "progress_percent": 0,
            "processed_frames": 0,
            "total_frames": 1,
            "alerts_count": 0,
        }

    session = app.state.sessions[session_id]
    job = session.get("job", {})
    total = max(1, int(job.get("total_frames", 1)))
    processed = max(0, min(total, int(job.get("processed_frames", 0))))
    progress_percent = min(100, int((processed / total) * 100))
    job["progress_percent"] = progress_percent

    return {
        "state": job.get("state", "pending"),
        "progress_percent": progress_percent,
        "processed_frames": processed,
        "total_frames": total,
        "current_camera": job.get("current_camera", "CAM-1"),
        "alerts_count": len(session.get("alerts", [])),
        "profile": session.get("profile", "balanced"),
        "error": job.get("error"),
        "started_at": job.get("started_at"),
        "completed_at": job.get("completed_at"),
    }


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
        task = app.state.session_tasks.pop(payload.session_id, None)
        if task and not task.done():
            task.cancel()
        app.state.sessions.pop(payload.session_id, None)
    else:
        for task in list(app.state.session_tasks.values()):
            if task and not task.done():
                task.cancel()
        app.state.session_tasks.clear()
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
