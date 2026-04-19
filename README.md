# Surveillance System

A production-minded missing-person surveillance workflow built with a Next.js operator console and a FastAPI + computer vision backend.

The platform is designed for fast operator decisions:

- Guided 3-step flow (photo upload -> camera uploads -> live review)
- Real asynchronous backend analysis jobs with progress reporting
- Profile-based detection modes (Fast, Balanced, Accurate)
- Snapshot-backed alerts with timestamps and similarity metadata
- Formal PDF evidence export with branding and investigator signature section

## Highlights

- Async job pipeline: backend analysis runs in background tasks per session
- Real progress API: frontend polls true frame-processing progress
- Profile presets: operators can choose speed vs precision tradeoff
- Drag-and-drop uploads: photo and video stages support drop zones
- Reset platform workflow: clears runtime state and returns user to home
- Top-left back navigation: consistent arrow navigation in workflow pages

## Tech Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: FastAPI, OpenCV, DeepFace, Ultralytics YOLO
- Evidence export: jsPDF

## Architecture

1. Operator uploads reference image + CAM-1/CAM-2 videos.
2. Frontend sends files to `/api/analyze` with selected profile.
3. Backend creates a session and starts async analysis workers.
4. Frontend polls:
	 - `/api/progress/{session_id}` for real progress
	 - `/api/alerts/{session_id}` for detections
5. Operator reviews detections and exports a formal PDF report.

## User Workflow

### 1) Home

- Entry page with workflow overview and actions.

### 2) Photo Upload (`/photo`)

- Upload or drag-and-drop a missing-person reference image.
- Live image preview before continuing.
- Top-left back arrow for quick navigation.

### 3) Video Upload (`/videos`)

- Upload or drag-and-drop CAM-1 and CAM-2 clips.
- Live preview panels for both video inputs.
- Top-left back arrow.

### 4) Review Console (`/review`)

- Real backend progress bar and job state display.
- Live stream panels and alert timeline.
- Evidence panel with first alert timestamp visibility.
- Formal PDF export.
- Reset Session and Reset Platform controls.
- Top-left back arrow.

## API Reference

### Health

- `GET /health`

### Start Analysis Job

- `POST /api/analyze`
- Form fields:
	- `missing_image` (file)
	- `cam1_video` (file)
	- `cam2_video` (file)
	- `profile` (`fast` | `balanced` | `accurate`)

### Progress

- `GET /api/progress/{session_id}`
- Response includes:
	- `state` (`pending` | `running` | `completed` | `failed`)
	- `progress_percent`
	- `processed_frames`
	- `total_frames`
	- `current_camera`
	- `alerts_count`
	- `profile`
	- `error`

### Alerts

- `GET /api/alerts/{session_id}`

### Streams

- `GET /api/stream/{session_id}/{cam_id}`
- `cam_id`: `CAM-1` or `CAM-2`

### Snapshot Fetch

- `GET /api/snapshots/{session_id}/{filename}`

### Reset Workspace

- `POST /api/system/reset-workspace`
- Body:
	- `session_id` (optional)
	- `prune_outputs` (boolean)

## Detection Profiles

- `Fast`: prioritizes speed, lower thresholds, higher frame stride
- `Balanced`: default operational mode
- `Accurate`: stricter thresholds, denser evaluation

Profile behavior is mapped server-side in `backend/engine.py` and can be tuned through environment variables.

## Local Setup

### One-command setup/start (recommended)

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_system.ps1
powershell -ExecutionPolicy Bypass -File .\start_app.ps1
```

### Clean full run

```powershell
powershell -ExecutionPolicy Bypass -File .\run_full_project.ps1
```

### Frontend only

```powershell
cd frontend
npm install
npm run dev
```

### Backend only

```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

## Deployment

### Frontend (Vercel)

- Root directory: `frontend`
- Install: `npm install`
- Build: `npm run build`
- Env:
	- `NEXT_PUBLIC_BACKEND_URL=https://your-backend-host`

### Backend

Deploy FastAPI separately (VM/container/platform service) and ensure CORS/network access from frontend.

## Environment and Tuning

Example backend tuning knobs:

- `MATCH_THRESHOLD`
- `YOLO_CONFIDENCE`
- `MAX_FRAME_WIDTH`
- `BASE_FRAME_STRIDE`
- `HIGH_FPS_STRIDE`
- `MATCH_CONFIRM_FRAMES`
- `SEGMENT_SECONDS`

These settings control speed/accuracy equilibrium for different hardware.

## Project Structure

```text
backend/                   FastAPI API, async jobs, CV engine
frontend/                  Next.js operator UI
scripts/                   Workspace cleanup utilities
run_full_project.ps1       Full clean + launch flow
setup_system.ps1           One-time setup script
start_app.ps1              Standard start script
_archive/                  Archived legacy material
```

## Professional Reporting Output

PDF export contains:

- Branded header/footer
- Session metadata
- Alert-by-alert breakdown
- Snapshot evidence
- Investigator signature and date fields

## Troubleshooting

- Backend offline in UI:
	- Verify backend is running on expected host/port
	- Check `NEXT_PUBLIC_BACKEND_URL`
- No alerts appearing:
	- Confirm usable reference image quality
	- Try `Fast` profile for earliest detection signal
	- Check `/api/progress/{session_id}` for `failed` state and error text
- Upload issues:
	- Ensure `python-multipart` is installed in backend environment

## Verification Commands

```powershell
cd frontend
npm run build

cd ..\backend
python -m py_compile app.py engine.py
```

## Developer

- Name: Ayush Kathil
- LinkedIn: https://www.linkedin.com/in/ayushkathil/
- GitHub: https://github.com/Ayush-kathil

## Git Workflow (Signed-off)

```powershell
git status
git add .
git commit -s -m "Describe the change"
git push origin main
```

The `-s` flag adds a sign-off line for clean contribution history.
