# Missing Person Detection System - Architecture Guide

## System Overview

The Missing Person Detection System is a production-grade Python application designed to automatically identify missing persons in CCTV video streams using facial recognition technology.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Input Sources                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Reference    │  │ CCTV Video 1 │  │ CCTV Video 2 │       │
│  │ Image        │  │ (MP4/AVI)    │  │ (MP4/AVI)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Face Engine (Core)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ - Reference Encoding Generation                        │ │
│  │ - Face Detection (CNN/HOG)                             │ │
│  │ - Face Encoding (128-D vectors)                        │ │
│  │ - Dual-Metric Matching (Cosine + Euclidean)          │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Video Processing Pipeline                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Camera 1        Camera 2        ... Camera N          │   │
│  │ ┌────────────┐  ┌────────────┐  ┌────────────┐       │   │
│  │ │VideoEngine │  │VideoEngine │  │VideoEngine │       │   │
│  │ │- Frame     │  │- Frame     │  │- Frame     │       │   │
│  │ │  Processing│  │  Processing│  │  Processing│       │   │
│  │ │- Matching  │  │- Matching  │  │- Matching  │       │   │
│  │ │- Alerts    │  │- Alerts    │  │- Alerts    │       │   │
│  │ └────────────┘  └────────────┘  └────────────┘       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Alert System                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Thread-Safe Detection Logging                          │ │
│  │ - Snapshot Capture                                     │ │
│  │ - Detection Record Creation                            │ │
│  │ - Log File Writing                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Output                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Log File     │  │ Snapshots    │  │ Reports      │       │
│  │ Detections   │  │ Detection    │  │ Analysis     │       │
│  │ Timestamps   │  │ Images       │  │ Statistics   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. FaceEngine (`src/face_engine.py`)
**Responsibility**: Face detection and encoding

**Key Methods**:
- `load_reference_encoding()`: Generate encoding from reference image
- `detect_and_encode()`: Find and encode all faces in a frame
- `find_best_match()`: Match candidate faces against reference
- `cosine_similarity()`: Calculate cosine distance metric
- `draw_label()`: Visualize detections on frames

**Technologies**:
- dlib CNN/HOG for face detection
- face_recognition library for 128-D encoding
- Scipy for Euclidean distance

### 2. VideoEngine (`src/video_engine.py`)
**Responsibility**: Per-camera video processing pipeline

**Key Methods**:
- `run()`: Main video processing loop
- `_process_frame()`: Single frame detection logic
- `_is_confirmed_hit()`: Stability check for confidence
- `_adapt_frame_skip()`: Dynamic frame skip optimization
- `_video_timestamp()`: Extract timestamp from video

**Features**:
- Dual-metric threshold validation
- Stability-based confirmation (N consecutive frames)
- Cooldown-based alert suppression
- Adaptive frame skip for performance

### 3. AlertSystem (`src/alert_system.py`)
**Responsibility**: Detection logging and output

**Key Methods**:
- `save_snapshot()`: Capture and save detection image
- `emit_detection()`: Log detection with metadata
- Thread-safe file access with locks

**Output Format**:
```
ALERT | CAM-1 | VIDEO_TIME=HH:MM:SS | EVENT_TIME=YYYY-MM-DD HH:MM:SS | SCORE=0.XXX | COSINE=0.XXX | EUCLIDEAN=0.XXX | SNAPSHOT=filename.jpg
```

### 4. Settings (`src/config.py`)
**Responsibility**: Centralized configuration

**Key Parameters**:
- Face matching thresholds (confidence, cosine, euclidean)
- Stability frames and cooldown seconds
- Performance settings (frame skip, processing time targets)
- Display and output directories

## Data Flow

### Detection Pipeline
```
Video Frame
    ↓
Face Detection (CNN/HOG)
    ↓
Face Encoding (128-D vector)
    ↓
Similarity Calculation
  ├─ Cosine Similarity
  └─ Euclidean Distance
    ↓
Weighted Score Calculation (70% cosine + 30% euclidean)
    ↓
Threshold Validation
    ├─ Primary: weighted_score ≥ confidence_threshold
    └─ Fallback: cosine ≥ cosine_threshold AND euclidean ≤ euclidean_threshold
    ↓
Stability Check (N consecutive matches)
    ↓
Cooldown Check (prevent duplicate alerts)
    ↓
Alert Triggered
    ├─ Snapshot Saved
    ├─ Log Entry Written
    └─ Console Output
```

## Threading Model

The system uses the following threading architecture:

```
Main Process (run())
    ↓
ThreadPoolExecutor (if use_multithreading=True)
    ├─ Camera 1 Thread (VideoEngine)
    ├─ Camera 2 Thread (VideoEngine)
    └─ Camera N Thread (VideoEngine)
        ↓
    Shared AlertSystem (thread-safe)
        └─ Lock-protected file writes
```

**Thread Safety**:
- AlertSystem uses `threading.Lock()` for file operations
- Each VideoEngine runs independently in its own thread
- Stop event is shared across all engines

## Configuration Flow

```
settings = Settings()  # Dataclass with frozen=True
    ↓
  (Passed to VideoEngine.__init__())
    ↓
  (VideoEngine uses for threshold validation)
    ↓
  (Affects detection sensitivity)
```

## Directory Structure

```
missing_person_project/
├── src/                    # Core application code
│   ├── __init__.py        # Package metadata
│   ├── config.py          # Settings dataclass
│   ├── face_engine.py     # Face detection/encoding
│   ├── video_engine.py    # Video processing
│   ├── alert_system.py    # Logging system
│   └── main.py            # System orchestrator
│
├── data/                  # Data directories
│   ├── input/            # Input data
│   │   ├── missing.jpg   # Reference image
│   │   ├── cam1.mp4      # Video source 1
│   │   └── cam2.mp4      # Video source 2
│   └── models/           # Pre-trained models (optional)
│
├── output/               # Generated outputs
│   ├── logs/            # Detection logs
│   │   └── detections.txt
│   ├── snapshots/       # Detection snapshots
│   └── reports/         # Analysis reports
│
├── scripts/             # Utility scripts
│   ├── diagnose_system.py      # System verification
│   └── analyze_results.py      # Results analysis
│
├── docs/                # Documentation
├── config/              # Configuration files
├── tests/               # Unit tests
├── run.py              # Entry point
├── setup.py            # Package setup
├── requirements.txt    # Dependencies
└── .gitignore         # Git ignore rules
```

## Key Design Decisions

### 1. Dual-Metric Matching
- **Why**: Single similarity metric (cosine only) has limitations
- **Solution**: Combine cosine similarity (angle) + euclidean distance (magnitude)
- **Benefit**: More accurate matching, fewer false positives/negatives

### 2. Weighted Scoring
```
weighted_score = (cosine_similarity × 0.7) + ((1 - normalized_euclidean) × 0.3)
```
- 70% weight on cosine similarity (preserves well-matched vectors)
- 30% weight on euclidean distance (captures magnitude differences)

### 3. Stability Frames
- **Why**: Prevent single-frame false positives
- **How**: Require N consecutive matching frames
- **Default**: 3 frames (balance between speed and accuracy)

### 4. Cooldown Period
- **Why**: Prevent alert spam for same person
- **How**: Don't alert again for X seconds after detection
- **Default**: 5 seconds

### 5. Adaptive Frame Skip
- **Why**: Balance accuracy vs performance
- **How**: Skip frames if processing time exceeds target
- **Target**: ~100ms per frame

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Frame Processing | 30-100ms | Depends on resolution and detector |
| Detection Latency | ~90-300ms | 3 frames at 30fps = 100ms |
| Face Detection Model | CNN or HOG | CNN more accurate, HOG faster |
| Encoding Time | ~20-50ms | Per face, uses face_recognition lib |
| Matching Time | <1ms | Dot product + distance calculations |

## Extension Points

Future enhancements can be added at:

1. **Face Detection**: Swap dlib detector for YOLOv3/v5
2. **Encoding**: Use different encoding models (ArcFace, VGGFace2)
3. **Matching**: Add hand-crafted features or re-ranking algorithms
4. **Alerts**: Add email, SMS, webhook notifications
5. **Storage**: Integrate with database for historical queries
6. **Dashboard**: Build web UI for real-time monitoring
7. **Multi-Reference**: Support multiple missing person images
8. **Cross-Camera Tracking**: Track person across camera views

## Security Considerations

- ✓ No hardcoded credentials
- ✓ Thread-safe file operations
- ✓ Input validation on file paths
- ✓ Proper error handling
- ✓ Configurable security thresholds

## Performance Optimization Tips

1. **Reduce video resolution** → Faster detection, less accurate
2. **Lower upsample_times** → Find only large faces
3. **Increase frame_skip** → Process fewer frames
4. **Use HOG detector** → Faster than CNN, less accurate
5. **Disable windows** → Reduce display overhead
6. **Multithreading** → Parallel camera processing

---

For detailed API documentation, see the docstrings in each module.
