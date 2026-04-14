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
    confidence_threshold: float = 0.60

    # Stability and anti-spam
    stability_frames: int = 5
    cooldown_seconds: int = 10

    # Performance controls
    use_multithreading: bool = True
    initial_frame_skip: int = 2
    max_frame_skip: int = 5
    target_processing_ms: float = 80.0

    # Display
    show_windows: bool = True
    window_wait_ms: int = 1


settings = Settings()
