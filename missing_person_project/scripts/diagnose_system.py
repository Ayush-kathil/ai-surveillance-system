"""
System diagnostics and verification for Missing Person Detection System.
Helps verify the system is working correctly before running detection.

Usage:
    python scripts/diagnose_system.py
"""

from pathlib import Path
import sys
import cv2
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_PATH = PROJECT_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from face_engine import FaceEngine
from config import settings


def test_reference_image() -> bool:
    """Test if the reference image can be loaded and processed."""
    print("=" * 80)
    print("TEST 1: Reference Image Loading")
    print("=" * 80)
    
    if not settings.missing_image.exists():
        print(f"❌ ERROR: Missing image not found: {settings.missing_image}")
        return False
    
    try:
        face_engine = FaceEngine(
            model_preference=settings.model_preference,
            upsample_times=settings.upsample_times,
        )
        
        ref_encoding = face_engine.load_reference_encoding(settings.missing_image)
        print(f"✓ Successfully loaded reference image: {settings.missing_image}")
        print(f"  - Encoding shape: {ref_encoding.shape}")
        print(f"  - Encoding norm: {float(np.linalg.norm(ref_encoding)):.4f}")
        return True
    except Exception as e:
        print(f"❌ ERROR loading reference: {e}")
        return False


def test_video_sources() -> bool:
    """Test if video sources are accessible."""
    print("\n" + "=" * 80)
    print("TEST 2: Video Sources")
    print("=" * 80)
    
    all_ok = True
    for i, source in enumerate(settings.camera_sources, 1):
        if not Path(source).exists():
            print(f"❌ Camera {i} NOT FOUND: {source}")
            all_ok = False
            continue
        
        try:
            cap = cv2.VideoCapture(str(source))
            if not cap.isOpened():
                print(f"❌ Camera {i} cannot be opened: {source}")
                all_ok = False
                continue
            
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            print(f"✓ Camera {i}: {Path(source).name}")
            print(f"  - Resolution: {width}x{height}")
            print(f"  - FPS: {fps}")
            print(f"  - Total frames: {frame_count}")
            print(f"  - Duration: {frame_count/fps:.1f}s" if fps > 0 else "")
            
            cap.release()
        except Exception as e:
            print(f"❌ Error checking camera {i}: {e}")
            all_ok = False
    
    return all_ok


def test_output_dirs() -> bool:
    """Test if output directories exist and are writable."""
    print("\n" + "=" * 80)
    print("TEST 3: Output Directories")
    print("=" * 80)
    
    try:
        settings.log_file.parent.mkdir(parents=True, exist_ok=True)
        settings.snapshot_dir.mkdir(parents=True, exist_ok=True)
        settings.reports_dir.mkdir(parents=True, exist_ok=True)
        
        # Test write access
        test_file = settings.log_file.parent / ".test_write"
        test_file.write_text("test")
        test_file.unlink()
        
        print(f"✓ Log directory: {settings.log_file.parent}")
        print(f"✓ Snapshot directory: {settings.snapshot_dir}")
        print(f"✓ Reports directory: {settings.reports_dir}")
        return True
    except Exception as e:
        print(f"❌ Error with output directories: {e}")
        return False


def show_configuration() -> None:
    """Display current configuration."""
    print("\n" + "=" * 80)
    print("CURRENT CONFIGURATION")
    print("=" * 80)
    
    config_items = [
        ("Model", settings.model_preference),
        ("Confidence Threshold", f"{settings.confidence_threshold:.2f}"),
        ("Cosine Threshold", f"{settings.cosine_threshold:.2f}"),
        ("Euclidean Threshold", f"{settings.euclidean_threshold:.2f}"),
        ("Stability Frames", settings.stability_frames),
        ("Cooldown (seconds)", settings.cooldown_seconds),
        ("Frame Skip (initial)", settings.initial_frame_skip),
        ("Frame Skip (max)", settings.max_frame_skip),
        ("Multithreading", "Enabled" if settings.use_multithreading else "Disabled"),
        ("Show Windows", "Yes" if settings.show_windows else "No"),
    ]
    
    for key, value in config_items:
        print(f"  {key:.<30} {value}")


def analyze_detections() -> None:
    """Analyze and display detection log."""
    print("\n" + "=" * 80)
    print("DETECTION ANALYSIS")
    print("=" * 80)
    
    if not settings.log_file.exists():
        print("No detection log found yet.")
        return
    
    with open(settings.log_file, 'r') as f:
        lines = f.readlines()
    
    # Skip header
    detections = [l for l in lines if l.startswith("ALERT")]
    
    if not detections:
        print("No detections recorded yet.")
        return
    
    print(f"Total detections: {len(detections)}\n")
    
    # Parse and group by camera
    by_camera = {}
    for line in detections:
        try:
            parts = line.split("|")
            camera_part = [p for p in parts if "CAM-" in p][0]
            camera = camera_part.split("CAM-")[1].split()[0]
            
            if camera not in by_camera:
                by_camera[camera] = []
            by_camera[camera].append(line.strip())
        except:
            pass
    
    for camera in sorted(by_camera.keys()):
        print(f"Camera CAM-{camera}: {len(by_camera[camera])} detections")
        for det in by_camera[camera][-3:]:  # Show last 3
            # Extract timestamp
            time_part = [p for p in det.split("|") if "VIDEO_TIME=" in p]
            if time_part:
                print(f"  {time_part[0].strip()}")


def main() -> int:
    """Run all diagnostics."""
    
    print("\n" + "=" * 80)
    print("MISSING PERSON DETECTION SYSTEM - DIAGNOSTICS")
    print("=" * 80 + "\n")
    
    results = []
    
    # Run tests
    results.append(("Reference Image", test_reference_image()))
    results.append(("Video Sources", test_video_sources()))
    results.append(("Output Directories", test_output_dirs()))
    
    # Show config and analysis
    show_configuration()
    analyze_detections()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for test_name, passed in results:
        status = "✓ PASS" if passed else "❌ FAIL"
        print(f"{test_name:.<40} {status}")
    
    all_passed = all(r[1] for r in results)
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✓ All checks passed! System is ready to run.")
        print("\nStart detection with: python run.py")
    else:
        print("❌ Some checks failed. Please review errors above.")
    print("=" * 80 + "\n")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
