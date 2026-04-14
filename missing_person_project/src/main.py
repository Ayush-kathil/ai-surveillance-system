"""Application orchestrator for Missing Person Detection System."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event

import cv2

from alert_system import AlertSystem
from config import settings
from face_engine import FaceEngine
from video_engine import CameraConfig, VideoEngine


def _validate_files() -> None:
    required = [settings.missing_image, *settings.camera_sources]
    missing = [path for path in required if not Path(path).exists()]
    if missing:
        formatted = "\n".join(f"- {m}" for m in missing)
        raise FileNotFoundError(f"Required input files missing:\n{formatted}")


def run() -> None:
    _validate_files()

    face_engine = FaceEngine(
        model_preference=settings.model_preference,
        upsample_times=settings.upsample_times,
    )
    reference_encoding = face_engine.load_reference_encoding(settings.missing_image)

    alert_system = AlertSystem(
        log_file=settings.log_file,
        snapshot_dir=settings.snapshot_dir,
    )

    stop_event = Event()
    camera_configs = [
        CameraConfig(camera_id=f"CAM-{i+1}", source=source)
        for i, source in enumerate(settings.camera_sources)
    ]

    engines = [
        VideoEngine(
            camera=cam,
            face_engine=face_engine,
            alert_system=alert_system,
            reference_encoding=reference_encoding,
            confidence_threshold=settings.confidence_threshold,
            stability_frames=settings.stability_frames,
            cooldown_seconds=settings.cooldown_seconds,
            initial_frame_skip=settings.initial_frame_skip,
            max_frame_skip=settings.max_frame_skip,
            target_processing_ms=settings.target_processing_ms,
            show_window=settings.show_windows,
            window_wait_ms=settings.window_wait_ms,
            stop_event=stop_event,
        )
        for cam in camera_configs
    ]

    print("Starting Missing Person Detection System...")
    print(f"Reference image: {settings.missing_image}")
    print("Press 'q' in any camera window to stop.")

    try:
        if settings.use_multithreading:
            with ThreadPoolExecutor(max_workers=len(engines)) as executor:
                futures = [executor.submit(engine.run) for engine in engines]
                for future in futures:
                    future.result()
        else:
            for engine in engines:
                if stop_event.is_set():
                    break
                engine.run()
    finally:
        cv2.destroyAllWindows()
        print(f"Log written to: {settings.log_file}")
        print(f"Snapshots saved in: {settings.snapshot_dir}")
