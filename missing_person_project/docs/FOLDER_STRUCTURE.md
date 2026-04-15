# Professional Project Structure

## Directory Tree

```
missing_person_project/
├── 📁 src/                          # Core application code
│   ├── __init__.py                 # Package metadata
│   ├── config.py                   # Settings and configuration
│   ├── face_engine.py              # Face detection & matching
│   ├── video_engine.py             # Video processing pipeline
│   ├── alert_system.py             # Detection logging
│   └── main.py                     # System orchestrator
│
├── 📁 data/                         # Input/Output data
│   ├── 📁 input/                   # Input data (videos, images)
│   │   ├── missing.jpg             # Reference image of person
│   │   ├── cam1.mp4                # CCTV video feed 1
│   │   └── cam2.mp4                # CCTV video feed 2
│   └── 📁 models/                  # Pre-trained models (optional)
│
├── 📁 output/                       # Generated outputs
│   ├── 📁 logs/                    # Detection logs
│   │   └── detections.txt          # All detections with timestamps
│   ├── 📁 snapshots/               # Detection snapshots
│   │   ├── CAM-1_20260415_143022.jpg
│   │   ├── CAM-2_20260415_144530.jpg
│   │   └── ...                     # One file per detection
│   └── 📁 reports/                 # Analysis reports
│       ├── detection_report_20260415_150000.txt
│       └── ...
│
├── 📁 scripts/                      # Utility and helper scripts
│   ├── diagnose_system.py          # System validation
│   └── analyze_results.py          # Results analysis tool
│
├── 📁 docs/                         # Documentation
│   ├── ARCHITECTURE.md             # System architecture
│   ├── CONFIGURATION.md            # Configuration guide
│   ├── QUICK_START.md              # Quick start guide
│   ├── IMPROVEMENTS.md             # Technical improvements
│   └── ...                         # Other documentation
│
├── 📁 config/                       # Configuration files
│   ├── .env.example                # Environment variables template
│   └── settings.yaml               # Optional YAML config
│
├── 📁 tests/                        # Unit and integration tests
│   ├── __init__.py
│   ├── test_face_engine.py         # Face detection tests
│   └── ...
│
├── 📄 run.py                        # Main entry point
├── 📄 setup.py                      # Package setup
├── 📄 requirements.txt              # Python dependencies
├── 📄 .gitignore                    # Git ignore rules
├── 📄 LICENSE                       # MIT License
└── 📄 README.md                     # Project README
```

## Directory Descriptions

### `src/` - Source Code
**Purpose**: Core application logic
- `__init__.py` - Package metadata and version
- `config.py` - Centralized configuration (Settings dataclass)
- `face_engine.py` - Face detection and encoding algorithms
- `video_engine.py` - Per-camera video processing loop
- `alert_system.py` - Thread-safe detection logging
- `main.py` - System orchestration and camera management

**Files are safe**: ✅ Production-ready code with error handling

### `data/input/` - Input Data
**Purpose**: Source files for detection
- `missing.jpg` - Reference image of missing person (REQUIRED)
- `cam1.mp4` - Video from camera 1 (can be any video format)
- `cam2.mp4` - Video from camera 2 (customizable)

**Files are safe**: ✅ Read-only input files

### `data/models/` - Pre-trained Models
**Purpose**: Optional model storage
- Currently empty (face-recognition models auto-download)
- Could store custom models here

**Files are safe**: ✅ Optional directory

### `output/logs/` - Detection Logs
**Purpose**: Record of all detections
- `detections.txt` - Log file with timestamps and confidence scores

**Files are safe**: ✅ Auto-generated, appended to (never deleted)

### `output/snapshots/` - Detection Images
**Purpose**: Visual verification of detections
- Named format: `CAM-X_YYYYMMDD_HHMMSS_microseconds.jpg`
- One file per detection

**Files are safe**: ✅ Auto-generated, can be deleted

### `output/reports/` - Analysis Reports
**Purpose**: Generated analysis documents
- Named format: `detection_report_YYYYMMDD_HHMMSS.txt`
- Exported from analyze_results.py

**Files are safe**: ✅ Auto-generated, can be deleted

### `scripts/` - Utility Scripts
**Purpose**: Helper tools
- `diagnose_system.py` - Verify system configuration
- `analyze_results.py` - Analyze detection results

**Files are safe**: ✅ Non-destructive read-only on logs

### `docs/` - Documentation
**Purpose**: Reference materials
- Architecture and design decisions
- Configuration options and tuning
- Quick start guides
- Improvement logs

**Files are safe**: ✅ Documentation only, no code execution

### `config/` - Configuration
**Purpose**: Configuration templates
- `.env.example` - Environment variable template
- No secrets or sensitive data

**Files are safe**: ✅ Templates and examples only

### `tests/` - Unit Tests
**Purpose**: Automated test suite
- Test face detection logic
- Test video processing
- Test detection accuracy

**Files are safe**: ✅ Read-only test code

### Root Files

| File | Purpose | Safe? |
|------|---------|-------|
| `run.py` | Main entry point | ✅ Yes |
| `setup.py` | Package installation | ✅ Yes |
| `requirements.txt` | Python dependencies | ✅ Yes |
| `.gitignore` | Git configuration | ✅ Yes |
| `LICENSE` | MIT license | ✅ Yes |
| `README.md` | Project documentation | ✅ Yes |

---

## File Safety Assessment

### ✅ Safe Files (Read-only or Non-destructive)
- All source code in `src/`
- All documentation in `docs/`
- All scripts in `scripts/` (only log analysis, no modifications)
- Configuration files
- Setup and requirement files

### ⚠️ Modified but Safe Files
- `output/logs/detections.txt` - Only appended to, never truncated
- `output/snapshots/*.jpg` - Generated for verification, can be deleted
- `output/reports/*.txt` - Exported reports, can be regenerated

### 🔒 Files to Protect
- `data/input/missing.jpg` - Your reference image
- `data/input/cam*.mp4` - Your video files
- Source code (back up regularly)

---

## Data File Locations

When configuring the system, use these paths:

```python
# In src/config.py
missing_image: Path = input_dir / "missing.jpg"
camera_sources: tuple[Path, Path] = (
    input_dir / "cam1.mp4",
    input_dir / "cam2.mp4",
)
```

Or manually place files:

```bash
# Place files in correct locations
cp my_missing_person.jpg missing_person_project/data/input/missing.jpg
cp camera1_footage.mp4 missing_person_project/data/input/cam1.mp4
cp camera2_footage.mp4 missing_person_project/data/input/cam2.mp4
```

---

## Workflow

```
1. Setup Phase
   │
   ├─→ Copy reference image to data/input/missing.jpg
   ├─→ Copy video files to data/input/cam*.mp4
   └─→ Run: python scripts/diagnose_system.py

2. Detection Phase
   │
   ├─→ Run: python run.py
   ├─→ Monitor console output
   └─→ Check output/snapshots/ for detections

3. Analysis Phase
   │
   ├─→ Run: python scripts/analyze_results.py
   ├─→ Review output/logs/detections.txt
   └─→ Check confidence scores and timestamps

4. Optimization Phase (Optional)
   │
   ├─→ Review accuracy of detections
   ├─→ Edit src/config.py parameters
   └─→ Repeat detection with new settings
```

---

## Professional Naming Conventions Used

### Python Files
- `snake_case` for scripts: `diagnose_system.py`, `analyze_results.py`
- Module names clear and descriptive: `face_engine.py`, `video_engine.py`
- `__init__.py` for packages
- `__main__.py` when needed

### Data Files
- Input images: `missing.jpg` (clear name)
- Video files: `cam1.mp4`, `cam2.mp4` (numbered by camera)
- Snapshots: `CAM-1_YYYYMMDD_HHMMSS_microseconds.jpg` (machine-readable)

### Log/Report Files
- Logs: `detections.txt` (singular, persistent)
- Reports: `detection_report_YYYYMMDD_HHMMSS.txt` (timestamped)

### Directories
- `src/` - Source code
- `data/` - Data files
- `input/` - Input data
- `output/` - Generated output
- `logs/` - Log files
- `snapshots/` - Images
- `reports/` - Reports
- `scripts/` - Utility scripts
- `docs/` - Documentation
- `config/` - Configuration
- `tests/` - Tests

---

## Space Usage

Typical disk usage:

```
Missing Person Detection System
├── Source code (src/)           ~1 MB
├── Documentation (docs/)        ~500 KB
├── Scripts (scripts/)           ~50 KB
│
├── Input data (data/input/)
│   ├── Reference image          ~100-500 KB
│   └── Video files (2x)         ~100-500 MB
│
└── Output (output/)
    ├── Logs (1 detection = ~200 bytes)
    ├── Snapshots (1x = ~50-100 KB)
    └── Reports (varies)
    
Total: 100 MB - 1 GB (mostly video files)
```

---

## Backup Recommendations

**Critical files to backup:**
- `data/input/missing.jpg` - Your reference image
- `data/input/cam*.mp4` - Your video files
- `output/logs/detections.txt` - Detection results
- `output/snapshots/` - Detection images
- `src/config.py` - Your custom configuration

**No need to backup:**
- Generated/auto-downloaded models
- Generated reports (can be regenerated)
- Python dependencies (in requirements.txt)

---

## Quick Commands

```bash
# View the structure
tree missing_person_project/

# Check what files exist
ls -la missing_person_project/

# View file sizes
du -sh missing_person_project/

# See recent detections
tail -20 output/logs/detections.txt

# View latest snapshots
ls -lt output/snapshots/ | head -10
```

---

## Summary

✅ **All files are professionally organized**
✅ **Clear separation of concerns**
✅ **Safe file structure (no accidental overwrites)**
✅ **Production-ready naming conventions**
✅ **Easy to navigate and maintain**
✅ **Scalable for future enhancements**
