# Surveillance System

This repository contains a two-part surveillance demo:

- A Next.js frontend in `frontend/`
- A FastAPI backend in `backend/`

The web app lets you upload a reference image plus two camera videos, start an analysis session, watch the alert stream, and export evidence from the browser.

## How It Works

1. You upload the missing-person image and two video files.
2. The frontend sends them to the backend at `/api/analyze`.
3. The backend creates a session, runs detection, and stores alerts in memory.
4. The frontend polls `/api/alerts/{session_id}` and streams frames from `/api/stream/{session_id}/{cam_id}`.
5. You review the alerts and export a text report from the UI.

## What To Run

Use the scripts in the repository root for the full local stack:

- First-time setup: `powershell -ExecutionPolicy Bypass -File .\setup_system.ps1`
- Normal start: `powershell -ExecutionPolicy Bypass -File .\start_app.ps1`
- Clean start: `powershell -ExecutionPolicy Bypass -File .\run_full_project.ps1`

If you only want the frontend:

```powershell
cd frontend
npm install
npm run dev
```

If you only want the backend:

```powershell
cd backend
python -m venv ..\.venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

## Vercel Deployment

This project is easiest to deploy to Vercel by pointing the Vercel project root to `frontend/`.

Set these values in Vercel:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Install Command: `npm install`
- Environment Variable: `NEXT_PUBLIC_BACKEND_URL=https://your-backend-host.example`

Important: Vercel will host the frontend only. The backend must be deployed separately and reachable from the browser.

## Main Commands

Frontend:

```powershell
cd frontend
npm install
npm run dev
npm run build
npm run start
npm run lint
```

Backend:

```powershell
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

Repository scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup_system.ps1
powershell -ExecutionPolicy Bypass -File .\start_app.ps1
powershell -ExecutionPolicy Bypass -File .\run_full_project.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup_workspace.ps1 -WhatIf
```

## Project Layout

```text
backend/                  FastAPI API and video processing engine
frontend/                 Next.js UI for uploads, alerts, and evidence export
scripts/                  Cleanup and maintenance scripts
start_app.ps1             One-command local startup
setup_system.ps1          One-time dependency and model setup
run_full_project.ps1      Cleanup plus startup flow
_archive/                 Legacy material kept out of the active app
missing_person_project/    Older standalone project and documentation
```

## Configuration Notes

- The frontend reads `NEXT_PUBLIC_BACKEND_URL`.
- If the variable is not set, it defaults to `http://localhost:8001`.
- The backend health check is exposed at `/health`.
- Alert data is exposed at `/api/alerts/{session_id}`.
- Live video streams are exposed at `/api/stream/{session_id}/{cam_id}`.

## Files Ignored By Git

Generated or local-only files are ignored, including:

- Python caches and virtual environments
- Next.js build output and `node_modules`
- Output folders, logs, database files, and local environment files
- Vercel local metadata

## Legacy Files

The following areas are not part of the Vercel deployment path and can be treated as legacy support material:

- `_archive/`
- `missing_person_project/`

## Troubleshooting

- If the UI shows the backend as offline, confirm the API is running on port `8001` or set `NEXT_PUBLIC_BACKEND_URL`.
- If uploads fail, confirm the backend has `python-multipart` installed.
- If Vercel builds fail, make sure the project root is set to `frontend/`.
- If face matching is too strict or too loose, adjust the backend thresholds in the engine/config files.

## Git Workflow

Use these commands when you are ready to publish changes:

```powershell
git status
git add .
git commit -s -m "Describe the change"
git push origin main
```

The `-s` flag adds a signed-off-by line to the commit, which is the standard sign-off format for clean project history.

## Deployment Notes

- The frontend is the part that goes to Vercel.
- The backend should be deployed separately to a server or container platform that can keep FastAPI running.
- Set `NEXT_PUBLIC_BACKEND_URL` to the public backend URL before deploying the frontend.
- If you want a local production-style frontend check, run `cd frontend` followed by `npm run build` and `npm run start`.

## Summary

For day-to-day work, the shortest path is:

1. Run `powershell -ExecutionPolicy Bypass -File .\setup_system.ps1` once.
2. Run `powershell -ExecutionPolicy Bypass -File .\start_app.ps1` to launch the full stack.
3. Deploy the frontend on Vercel from the `frontend/` folder and point it at your backend URL.
