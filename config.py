"""Configuration settings for Missing Person Detection System."""

from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
MISSING_PERSON_IMAGE = BASE_DIR / "missing.jpg"

# CCTV video feeds (simulated live streams)
VIDEO_SOURCES = [BASE_DIR / f"cam{i}.mp4" for i in range(1, 6)]

# Detection and matching controls
# Lower tolerance means stricter matching. Typical useful range: 0.4 to 0.6
FACE_MATCH_TOLERANCE = 0.48
UPSAMPLE_TIMES = 0
FACE_DETECTION_MODEL = "hog"  # Use "cnn" if dlib CUDA setup is available.
FRAME_SKIP = 2  # Process every Nth frame for better speed.
DISPLAY_SCALE = 1.0

# Runtime behavior
ENABLE_THREADING = True
SHOW_WINDOWS = True
REALTIME_DELAY_MS = 1
MAX_SNAPSHOTS_PER_CAMERA = 10

# Output paths
LOG_FILE = BASE_DIR / "detections.txt"
SNAPSHOT_DIR = BASE_DIR / "snapshots"
