"""Configuration settings for Missing Person Detection System."""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
MISSING_PERSON_IMAGE = BASE_DIR / "missing.jpg"

# CCTV video feeds (simulated live streams)
VIDEO_SOURCES = [BASE_DIR / "cam1.mp4", BASE_DIR / "cam2.mp4"]

# Output paths
OUTPUT_DIR = BASE_DIR / "output"
LOG_DIR = OUTPUT_DIR / "logs"
SNAPSHOT_DIR = OUTPUT_DIR / "snapshots"
# Ensure output directories exist early
LOG_DIR.mkdir(parents=True, exist_ok=True)
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "detections.txt"

# Detection and matching controls
FACE_DETECTION_MODEL = os.getenv("MP_MODEL_PREFERENCE", "hog")  # Use "cnn" if CUDA is available
UPSAMPLE_TIMES = 1 # Find smaller faces
FACE_MATCH_TOLERANCE = 0.48  # (Legacy) Backwards compatibility
CONFIDENCE_THRESHOLD = 0.55  # Minimum weighted score
COSINE_THRESHOLD = 0.50
EUCLIDEAN_THRESHOLD = 0.65

# Stability and anti-spam
STABILITY_FRAMES = 3
COOLDOWN_SECONDS = 5

# Runtime behavior
FRAME_SKIP = 2
INITIAL_FRAME_SKIP = 1
MAX_FRAME_SKIP = 3
ENABLE_THREADING = True
SHOW_WINDOWS = True
REALTIME_DELAY_MS = 1
MAX_SNAPSHOTS_PER_CAMERA = 10
