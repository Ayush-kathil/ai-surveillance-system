# Configuration Guide

## Overview

Configuration in the Missing Person Detection System is managed through the `Settings` dataclass in `src/config.py`.

## Configuration Parameters

### Path Configuration

```python
# Data directories
data_dir: Path = project_root / "data"
input_dir: Path = data_dir / "input"
missing_image: Path = input_dir / "missing.jpg"
camera_sources: tuple[Path, Path] = (
    input_dir / "cam1.mp4",
    input_dir / "cam2.mp4",
)

# Output directories
output_dir: Path = project_root / "output"
log_file: Path = output_dir / "logs" / "detections.txt"
snapshot_dir: Path = output_dir / "snapshots"
reports_dir: Path = output_dir / "reports"
```

### Face Detection Settings

```python
# Model selection
model_preference: str = "auto"  # "auto", "cnn", or "hog"
# - "auto": Uses CNN if CUDA available, falls back to HOG
# - "cnn": Slower but more accurate face detection
# - "hog": Faster but less accurate face detection

# Upsampling for small faces
upsample_times: int = 2
# - 0: Don't upsample (faster, misses small faces)
# - 1: 1x upsampling (balanced)
# - 2+: More upsampling (slower, finds smaller faces)
```

### Confidence Thresholds

```python
# Primary weighted confidence threshold
confidence_threshold: float = 0.55
# - Range: 0.0 to 1.0
# - Lower = more sensitive (more detections, more false positives)
# - Higher = more selective (fewer detections, fewer false positives)
# - Recommended: 0.35-0.75

# Secondary cosine similarity threshold
cosine_threshold: float = 0.50
# - Range: -1.0 to 1.0 (but typically 0.0 to 1.0)
# - Fallback metric if weighted score is between thresholds

# Secondary euclidean distance threshold
euclidean_threshold: float = 0.65
# - Range: 0.0 to 2.0+
# - Lower = stricter matching
# - Used jointly with cosine_threshold as fallback
```

### Stability Settings

```python
# Consecutive frames required for confirmation
stability_frames: int = 3
# - Higher = more stable (fewer false positives, slower detection)
# - Lower = faster detection (fewer frames before alert)
# - Typical: 2-7 frames

# Cooldown between alerts
cooldown_seconds: int = 5
# - Prevent alert spam for same person
# - Higher = fewer duplicate alerts
# - Typical: 5-20 seconds
```

### Performance Settings

```python
# Enable multi-threading for multiple cameras
use_multithreading: bool = True
# - True: Process all cameras simultaneously
# - False: Process cameras sequentially

# Frame skipping strategy
initial_frame_skip: int = 1
# - 1 = Process every frame
# - 2 = Process every 2nd frame
# - Higher = faster but misses frames

max_frame_skip: int = 3
# - Maximum frames to skip
# - System adapts between initial and max based on time

target_processing_ms: float = 100.0
# - Target time per frame in milliseconds
# - If exceeded, frame skip increases
# - If under 60% of target, frame skip decreases
```

### Display Settings

```python
# Show video windows
show_windows: bool = True
# - True: Display live detection visualization
# - False: Headless mode (no display)

# Window refresh rate
window_wait_ms: int = 1
# - Milliseconds to wait between window updates
# - Higher = lower CPU usage, lower frame rate
# - Typical: 1-30
```

## Configuration Presets

### Preset 1: Maximum Sensitivity ("Find Them")
Use when you MUST find the person, can tolerate false alarms.

```python
# src/config.py
confidence_threshold = 0.35
cosine_threshold = 0.30
stability_frames = 2
cooldown_seconds = 5
model_preference = "cnn"
upsample_times = 2
initial_frame_skip = 1
```

### Preset 2: Balanced (Default)
Recommended for most situations.

```python
# src/config.py
confidence_threshold = 0.55
cosine_threshold = 0.50
stability_frames = 3
cooldown_seconds = 5
model_preference = "auto"
upsample_times = 2
initial_frame_skip = 1
```

### Preset 3: Maximum Accuracy ("Certain Match")
Use when you want high confidence detections, can miss some instances.

```python
# src/config.py
confidence_threshold = 0.75
cosine_threshold = 0.70
stability_frames = 7
cooldown_seconds = 20
model_preference = "cnn"
upsample_times = 1
initial_frame_skip = 1
```

### Preset 4: Maximum Performance ("Fast Processing")
Use for resource-constrained systems.

```python
# src/config.py
confidence_threshold = 0.55
stability_frames = 3
initial_frame_skip = 3
max_frame_skip = 5
model_preference = "hog"
show_windows = False
upsample_times = 0
```

## How to Configure

### 1. Edit Configuration File

```bash
# Edit the configuration
nano src/config.py
```

### 2. Modify Settings Class

```python
# In src/config.py, modify the Settings dataclass
@dataclass(frozen=True)
class Settings:
    # Change these values
    confidence_threshold: float = 0.45  # Lower for more sensitivity
    stability_frames: int = 2           # Lower for faster detection
    # ...
```

### 3. Create Custom Configuration

```python
# Create a custom settings subclass
@dataclass(frozen=True)
class HighSensitivitySettings(Settings):
    confidence_threshold: float = 0.35
    stability_frames: int = 2
    
# Use it in main.py
settings = HighSensitivitySettings()
```

## Common Tuning Scenarios

### Scenario 1: Not Finding the Person

**Symptoms**: No detections in log file

**Adjustments**:
```python
confidence_threshold = 0.35      # (was 0.55) - Lower threshold
cosine_threshold = 0.30          # (was 0.50) - More lenient
stability_frames = 2             # (was 3) - Faster confirmation
model_preference = "cnn"         # (was "auto") - Better detection
upsample_times = 2              # Keep for small faces
```

**Also check**:
- Is reference image clear and frontal?
- Is video quality good?
- Are faces visible and unobstructed?
- Is face at least 50x50 pixels in video?

### Scenario 2: Too Many False Alarms

**Symptoms**: Many detections of wrong people

**Adjustments**:
```python
confidence_threshold = 0.75      # (was 0.55) - Higher threshold
cosine_threshold = 0.70          # (was 0.50) - More strict
stability_frames = 7             # (was 3) - More confirmation frames
cooldown_seconds = 20            # (was 5) - Longer wait
```

**Also check**:
- Is reference image overexposed/underexposed?
- Are there similar-looking people in video?
- Is lighting dramatically different?

### Scenario 3: Slow Processing / High CPU

**Symptoms**: Processing is laggy, CPU usage high

**Adjustments**:
```python
model_preference = "hog"         # (was "auto") - Faster detector
initial_frame_skip = 3           # (was 1) - Skip more frames
max_frame_skip = 5               # (was 3) - Allow more skipping
upsample_times = 0               # (was 2) - Disable upsampling
show_windows = False             # (was True) - No display overhead
```

### Scenario 4: Missing Some Detections

**Symptoms**: Person is in video but not detected every time

**Adjustments**:
```python
initial_frame_skip = 1           # (was 2+) - Process all frames
confidence_threshold = 0.45      # (was 0.55) - More sensitive
upsample_times = 1               # (was 2) - Light upsampling
max_frame_skip = 2               # (was 3) - Allow less skipping
```

## Monitoring Configuration Impact

### Verify Settings Applied

```bash
# Run diagnostics - shows current config
python scripts/diagnose_system.py
```

### Test Configuration Changes

```bash
# 1. Make configuration change
# 2. Run diagnostics
python scripts/diagnose_system.py

# 3. Run detector (Ctrl+C to stop)
python run.py

# 4. Analyze results
python scripts/analyze_results.py
```

## Parameter Interactions

Some parameters interact:

1. **confidence_threshold + stability_frames**
   - Lower threshold but higher frames = balanced sensitivity
   - Higher threshold but lower frames = fast but strict

2. **model_preference + upsample_times**
   - CNN + 2x upsample = highest accuracy, slowest
   - HOG + 0x upsample = fastest, least accurate

3. **initial_frame_skip + max_frame_skip**
   - Should have: initial_frame_skip ≤ max_frame_skip
   - Wider gap = more adaptive frame skipping

## Environment Variables (Optional)

Create `.env` file in config directory:

```bash
# config/.env
CONFIDENCE_THRESHOLD=0.55
COSINE_THRESHOLD=0.50
STABILITY_FRAMES=3
COOLDOWN_SECONDS=5
MODEL_PREFERENCE=auto
```

Then load in code:

```python
from dotenv import load_dotenv
load_dotenv("config/.env")
```

## Best Practices

1. **Start with defaults**: The default configuration is well-balanced
2. **Change one parameter at a time**: See impact of individual changes
3. **Test incrementally**: Make small adjustments, test, then fine-tune
4. **Document your changes**: Keep notes on what works for your videos
5. **Use presets as starting points**: Adapt presets to your needs
6. **Monitor CPU/memory**: Check resource usage with your settings
7. **Test on actual data**: Don't rely on test videos alone

## Troubleshooting Configuration

**Q: Settings not applying?**
- A: The Settings dataclass is frozen. Create a new subclass or edit directly.

**Q: What if I set threshold to 0.99?**
- A: Almost no detections (very strict). Start with default if unsure.

**Q: What if I set threshold to 0.01?**
- A: Almost everything detected (very sensitive). High false positive rate.

**Q: Should I use CNN or HOG?**
- A: Use "auto" - automatically chooses based on hardware

**Q: How do I know best settings?**
- A: Experiment with presets, then fine-tune based on results

---

For more details on what each parameter does, see the docstring in `src/config.py`.
