# Missing Person Detection System

Production-style Python project for missing person detection from CCTV video streams using a reference image.

## Project Layout

missing_person_project/
- data/
  - missing.jpg
  - cam1.mp4
  - cam2.mp4
- output/
  - logs/detections.txt
  - snapshots/
- src/
  - config.py
  - face_engine.py
  - video_engine.py
  - alert_system.py
  - main.py
- requirements.txt
- run.py

## Single Command to Run

From the workspace root, run:

python missing_person_project/run.py

If you are already inside missing_person_project, run:

python run.py

## First-Time Setup

If dependencies are not installed yet:

python -m pip install -r missing_person_project/requirements.txt
python -m pip install face_recognition --no-deps
python -m pip install Pillow Click

This requirements flow is optimized for Windows and avoids slow dlib source compilation.

PowerShell note:
- Use `python run.py` (or `python missing_person_project/run.py`) instead of typing `run.py` directly.

## Detection Logic

- Face detection model: cnn when CUDA is available, otherwise hog fallback.
- Encodings are normalized before matching.
- Matching uses cosine similarity.
- Alert condition:
  - similarity >= 0.60
  - same identity stable for 5 consecutive processed frames.
- Cooldown is 10 seconds between alerts per camera to reduce duplicate alarms.
- Frame skipping adapts dynamically for FPS optimization.

## Outputs

- Live windows for CAM-1 and CAM-2 with bounding boxes and confidence.
- Console alerts with camera ID and timestamp.
- Log file at missing_person_project/output/logs/detections.txt.
- Snapshots at missing_person_project/output/snapshots/.

## Controls

- Press q in any camera window to stop processing.

## Notes

- Ensure the data files exist at:
  - missing_person_project/data/missing.jpg
  - missing_person_project/data/cam1.mp4
  - missing_person_project/data/cam2.mp4
- missing.jpg must contain a clear frontal face. The current file analyzed in this workspace is 95x95 and no face was detected by either face_recognition or OpenCV Haar cascade.
- Tune thresholds and behavior in missing_person_project/src/config.py.
