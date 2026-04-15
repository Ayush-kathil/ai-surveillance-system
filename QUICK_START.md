# 🚀 QUICK START GUIDE

## Installation (5 minutes)

```powershell
# Navigate to project directory
cd "c:\Users\donay\Documents\GIT HUB\surveillance system\missing_person_project"

# Install dependencies (one-time setup)
pip install -r requirements.txt
```

---

## Prepare Your Data (2 minutes)

1. **Add reference image** - Clear photo of missing person
   ```
   Place in: data/missing.jpg
   ```

2. **Add video files** - CCTV footage
   ```
   Place in: data/cam1.mp4, data/cam2.mp4
   
   Or edit src/config.py to use your video paths
   ```

---

## Verify Setup (2 minutes)

```powershell
# Check system is ready
python diagnose.py
```

Should show:
- ✓ Reference image loaded
- ✓ Video sources accessible
- ✓ Output directories ready

---

## Run Detection (1 minute)

```powershell
# Start monitoring
python run.py
```

You should see:
```
Starting Missing Person Detection System...
Reference image: data/missing.jpg
Press 'q' in any camera window to stop.
```

---

## Check Results (1 minute)

```powershell
# View detection report
python analyze_detections.py
```

Or check logs manually:
```powershell
# View raw detections
cat output/logs/detections.txt

# View saved snapshots
ls output/snapshots/
```

---

## Sample Detection Output

```
ALERT | CAM-1 | VIDEO_TIME=01:23:45 | EVENT_TIME=2026-04-15 14:30:22 | SCORE=0.742 | COSINE=0.680 | EUCLIDEAN=0.512 | SNAPSHOT=CAM-1_...jpg
```

**Means:** Person found in Camera 1 at 1:23:45 in the video with 74.2% confidence

---

## Troubleshooting

### ❌ No Detections Found

**Solution 1: Lower the threshold**
```python
# Edit src/config.py
confidence_threshold = 0.35  # (was 0.55)
```

**Solution 2: Try better model**
```python
# Edit src/config.py
model_preference = "cnn"  # (was "auto")
```

**Solution 3: Check reference image**
- Make sure data/missing.jpg is clear
- Frontal face, good lighting
- At least 100x100 pixels

### ⚠️ Too Many False Alarms

**Solution 1: Raise the threshold**
```python
# Edit src/config.py
confidence_threshold = 0.70  # (was 0.55)
```

**Solution 2: Require more stability**
```python
# Edit src/config.py
stability_frames = 7  # (was 3)
```

### 🐌 Slow Processing

**Solution 1: Reduce accuracy for speed**
```python
# Edit src/config.py
model_preference = "hog"      # Faster
initial_frame_skip = 3        # Skip more frames
upsample_times = 0            # Skip upsampling
```

---

## Configuration Options

**Fast vs Accurate:**
```python
# For ACCURACY (but slower)
model_preference = "cnn"
upsample_times = 2
confidence_threshold = 0.45

# For SPEED (but less accurate)
model_preference = "hog"
upsample_times = 0
confidence_threshold = 0.65
initial_frame_skip = 3
```

**Sensitive vs Strict:**
```python
# SENSITIVE (finds person but more false alarms)
confidence_threshold = 0.35
stability_frames = 2
cooldown_seconds = 5

# STRICT (fewer false alarms but might miss person)
confidence_threshold = 0.75
stability_frames = 7
cooldown_seconds = 20
```

---

## File Locations

```
input/  data/
  ├─ missing.jpg          ← Reference image (REQUIRED)
  ├─ cam1.mp4             ← Video from camera 1 (REQUIRED)
  └─ cam2.mp4             ← Video from camera 2 (REQUIRED)

output/
  ├─ logs/
  │  └─ detections.txt    ← All detections with timestamps
  └─ snapshots/           ← Images of detected persons
      ├─ CAM-1_...jpg
      ├─ CAM-2_...jpg
      └─ ...

src/
  ├─ config.py            ← EDIT FOR TUNING
  ├─ face_engine.py       ← Face detection
  ├─ video_engine.py      ← Video processing
  ├─ alert_system.py      ← Logging
  └─ main.py              ← Main orchestrator

run.py                     ← START HERE
diagnose.py               ← System check
analyze_detections.py     ← View results
```

---

## Command Reference

```powershell
# Install dependencies (one-time)
pip install -r requirements.txt

# Check system setup
python diagnose.py

# Start detection
python run.py

# View results
python analyze_detections.py

# View raw log
cat output/logs/detections.txt

# View snapshots
ls output/snapshots/
```

---

## What Gets Logged When Person is Found?

Each detection includes:
- 📹 **Camera ID**: Which camera (CAM-1, CAM-2)
- ⏱️ **Video Time**: When in the video (HH:MM:SS)
- 🕐 **Event Time**: When detected (system time)
- 📊 **Confidence Scores**: 3 different metrics
- 📸 **Snapshot**: Image of the detected person

---

## Next: Advanced Configuration

For detailed tuning options, see:
- `IMPROVEMENTS.md` - Technical details
- `README.md` - Complete documentation
- `src/config.py` - All configuration options

---

## Support

1. **Run diagnostics** to verify setup:
   ```bash
   python diagnose.py
   ```

2. **Check detection logs**:
   ```bash
   cat output/logs/detections.txt
   ```

3. **Review snapshots** visually:
   ```bash
   ls output/snapshots/
   ```

4. **Adjust configuration** in `src/config.py` and retry

---

Good luck! The system is now ready to find the missing person! 🎯
