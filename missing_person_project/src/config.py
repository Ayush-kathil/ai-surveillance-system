"""Central configuration for Missing Person Detection System."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    """Runtime settings with conservative defaults for precision-focused detection."""

    project_root: Path = Path(__file__).resolve().parents[1]

    # Input files - Data directory structure
    data_dir: Path = project_root / "data"
    input_dir: Path = data_dir / "input"
    models_dir: Path = data_dir / "models"
    
    missing_image: Path = input_dir / "missing.jpg"
    camera_sources: tuple[Path, Path] = (
        input_dir / "cam1.mp4",
        input_dir / "cam2.mp4",
    )

    # Output files - organized by type
    output_dir: Path = project_root / "output"
    log_file: Path = output_dir / "logs" / "detections.txt"
    snapshot_dir: Path = output_dir / "snapshots"
    reports_dir: Path = output_dir / "reports"

    # Face detection and matching
    model_preference: str = os.getenv("MP_MODEL_PREFERENCE", "auto")
    upsample_times: int = _env_int("MP_UPSAMPLE_TIMES", 2)
    
    # Improved confidence thresholds
    confidence_threshold: float = _env_float("MP_CONFIDENCE_THRESHOLD", 0.55)
    cosine_threshold: float = _env_float("MP_COSINE_THRESHOLD", 0.50)
    euclidean_threshold: float = _env_float("MP_EUCLIDEAN_THRESHOLD", 0.65)

    # Stability and anti-spam
    stability_frames: int = _env_int("MP_STABILITY_FRAMES", 3)
    cooldown_seconds: int = _env_int("MP_COOLDOWN_SECONDS", 5)

    # Performance controls
    use_multithreading: bool = _env_bool("MP_USE_MULTITHREADING", True)
    initial_frame_skip: int = _env_int("MP_INITIAL_FRAME_SKIP", 1)
    max_frame_skip: int = _env_int("MP_MAX_FRAME_SKIP", 3)
    target_processing_ms: float = _env_float("MP_TARGET_PROCESSING_MS", 100.0)
    process_scale: float = _env_float("MP_PROCESS_SCALE", 0.5)

    # Display
    show_windows: bool = _env_bool("MP_SHOW_WINDOWS", True)
    window_wait_ms: int = _env_int("MP_WINDOW_WAIT_MS", 1)


settings = Settings()
