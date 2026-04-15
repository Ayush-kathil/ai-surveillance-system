"""Central configuration for Missing Person Detection System."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    """Runtime settings with conservative defaults for precision-focused detection."""

    project_root: Path = Path(__file__).resolve().parents[1]

    # Input files
    data_dir: Path = project_root / "data"
    missing_image: Path = data_dir / "missing.jpg"
    camera_sources: tuple[Path, Path] = (
        data_dir / "cam1.mp4",
        data_dir / "cam2.mp4",
    )

    # Output files
    output_dir: Path = project_root / "output"
    log_file: Path = output_dir / "logs" / "detections.txt"
    snapshot_dir: Path = output_dir / "snapshots"

    # Face detection and matching
    model_preference: str = "auto"  # auto, cnn, hog
    upsample_times: int = 2
    
    # Improved confidence thresholds
    confidence_threshold: float = 0.55  # Weighted score threshold (lowered for better detection)
    cosine_threshold: float = 0.50  # Additional cosine threshold
    euclidean_threshold: float = 0.65  # Euclidean distance threshold (0-1 range)

    # Stability and anti-spam
    stability_frames: int = 3  # Reduced for faster detection (was 5)
    cooldown_seconds: int = 5  # Reduced for more frequent alerts (was 10)

    # Performance controls
    use_multithreading: bool = True
    initial_frame_skip: int = 1  # Process every frame initially
    max_frame_skip: int = 3  # Max skip to maintain accuracy
    target_processing_ms: float = 100.0

    # Display
    show_windows: bool = True
    window_wait_ms: int = 1


settings = Settings()
