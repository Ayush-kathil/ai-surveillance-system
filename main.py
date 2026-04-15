"""Missing Person Detection System entry point."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from typing import List

import cv2

import config
from alerts import AlertManager
from face_utils import load_missing_person_encoding
from video_processor import CameraConfig, VideoProcessor


def _validate_sources(video_sources: List[Path]) -> List[Path]:
    missing = [src for src in video_sources if not src.exists()]
    if missing:
        missing_list = "\n".join(f"- {m}" for m in missing)
        raise FileNotFoundError(
            "One or more video files are missing. Expected files:\n" + missing_list
        )
    return video_sources


def run_system() -> None:
    print("Starting Missing Person Detection System...")
    
    if not config.MISSING_PERSON_IMAGE.exists():
        print(f"Fatal error: Missing person image not found: {config.MISSING_PERSON_IMAGE}")
        print("Please place 'missing.jpg' in the root directory.")
        return

    print(f"Target image: {config.MISSING_PERSON_IMAGE}")
    target_encoding = load_missing_person_encoding(
        image_path=config.MISSING_PERSON_IMAGE,
        model=config.FACE_DETECTION_MODEL,
        upsample_times=config.UPSAMPLE_TIMES,
    )
    print("Missing person face encoding loaded and normalized.")

    video_sources = _validate_sources(config.VIDEO_SOURCES)
    alert_manager = AlertManager(config.LOG_FILE)
    stop_event = Event()

    processors = []
    for idx, source in enumerate(video_sources, start=1):
        camera = CameraConfig(camera_id=f"CAM-{idx}", source=source)
        processors.append(
            VideoProcessor(
                camera=camera,
                target_encoding=target_encoding,
                alert_manager=alert_manager,
                model=config.FACE_DETECTION_MODEL,
                upsample_times=config.UPSAMPLE_TIMES,
                frame_skip=config.FRAME_SKIP,
                show_window=config.SHOW_WINDOWS,
                realtime_delay_ms=config.REALTIME_DELAY_MS,
                snapshot_dir=config.SNAPSHOT_DIR,
                max_snapshots=config.MAX_SNAPSHOTS_PER_CAMERA,
                stop_event=stop_event,
            )
        )

    if config.ENABLE_THREADING:
        print("Processing camera feeds with multithreading enabled.")
        with ThreadPoolExecutor(max_workers=len(processors)) as executor:
            futures = [executor.submit(processor.run) for processor in processors]
            for future in futures:
                future.result()
    else:
        print("Processing camera feeds sequentially.")
        for processor in processors:
            if stop_event.is_set():
                break
            processor.run()

    cv2.destroyAllWindows()
    print(f"Session ended. Detection log saved to: {config.LOG_FILE}")


if __name__ == "__main__":
    try:
        run_system()
    except KeyboardInterrupt:
        cv2.destroyAllWindows()
        print("Stopped by user.")
    except Exception as exc:
        cv2.destroyAllWindows()
        import traceback
        traceback.print_exc()
