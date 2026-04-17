from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import tempfile
import subprocess
from pathlib import Path
from pydantic import BaseModel
from engine import load_encoding_from_image, warm_up_models
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
from fastapi.responses import StreamingResponse
import asyncio

app.state.sessions = {}

@app.post("/api/analyze")
async def analyze_surveillance(
    missing_image: UploadFile = File(...),
    cam1_video: UploadFile = File(...),
    cam2_video: UploadFile = File(...)
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
        app.state.sessions[session_id] = {
            "target_encoding": target_encoding,
            "CAM-1": cam1_path,
            "CAM-2": cam2_path,
            "alerts": []
        }
        
        return {"status": "success", "session_id": session_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stream/{session_id}/{cam_id}")
async def stream_video(session_id: str, cam_id: str):
    if session_id not in app.state.sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    if cam_id not in ["CAM-1", "CAM-2"]:
        raise HTTPException(status_code=404, detail="Invalid camera ID")
        
    video_path = app.state.sessions[session_id][cam_id]
    target_encoding = app.state.sessions[session_id]["target_encoding"]
    
    from engine import yield_video_frames
    return StreamingResponse(
        yield_video_frames(video_path, cam_id, target_encoding, app.state.sessions[session_id]["alerts"]),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/api/alerts/{session_id}")
def get_alerts(session_id: str):
    if session_id not in app.state.sessions:
        return {"alerts": []}
    return {"alerts": app.state.sessions[session_id]["alerts"]}

@app.get("/health")
def read_root():
    return {"status": "Online"}


class ResetRequest(BaseModel):
    session_id: str | None = None
    prune_outputs: bool = True


@app.post("/api/system/reset-workspace")
async def reset_workspace(payload: ResetRequest):
    if payload.session_id:
        app.state.sessions.pop(payload.session_id, None)
    else:
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
