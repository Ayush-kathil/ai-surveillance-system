"""Video feed processing pipeline for CCTV camera streams."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from threading import Event
from typing import Optional

import cv2
import numpy as np

from alerts import AlertManager
from face_utils import detect_and_encode_faces, draw_face_annotation, match_face


@dataclass
class CameraConfig:
    camera_id: str
    source: Path


class VideoProcessor:
    """Process one camera feed and emit match alerts in real-time."""

    def __init__(
        self,
        camera: CameraConfig,
        target_encoding: np.ndarray,
        alert_manager: AlertManager,
        model: str,
        upsample_times: int,
        tolerance: float,
        frame_skip: int,
        show_window: bool,
        realtime_delay_ms: int,
        snapshot_dir: Path,
        max_snapshots: int,
        stop_event: Event,
    ) -> None:
        self.camera = camera
        self.target_encoding = target_encoding
        self.alert_manager = alert_manager
        self.model = model
        self.upsample_times = upsample_times
        self.tolerance = tolerance
        self.frame_skip = max(1, frame_skip)
        self.show_window = show_window
        self.realtime_delay_ms = max(1, realtime_delay_ms)
        self.snapshot_dir = Path(snapshot_dir)
        self.max_snapshots = max_snapshots
        self.stop_event = stop_event
        self._snapshot_count = 0

    def run(self) -> None:
        cap = cv2.VideoCapture(str(self.camera.source))
        if not cap.isOpened():
            print(f"Error: Unable to open source for {self.camera.camera_id}: {self.camera.source}")
            return

        window_name = f"{self.camera.camera_id} - Live"
        frame_index = 0

        if self.show_window:
            cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        try:
            while not self.stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    break

                frame_index += 1
                process_this_frame = frame_index % self.frame_skip == 0

                if process_this_frame:
                    self._process_frame_for_match(frame)

                if self.show_window:
                    cv2.imshow(window_name, frame)
                    # q exits all streams
                    if cv2.waitKey(self.realtime_delay_ms) & 0xFF == ord("q"):
                        self.stop_event.set()
                        break
        finally:
            cap.release()
            if self.show_window:
                cv2.destroyWindow(window_name)

    def _process_frame_for_match(self, frame: np.ndarray) -> None:
        locations, encodings = detect_and_encode_faces(
            frame,
            model=self.model,
            upsample_times=self.upsample_times,
        )

        if not encodings:
            return

        for location, face_encoding in zip(locations, encodings):
            matched, confidence = match_face(
                self.target_encoding,
                face_encoding,
                tolerance=self.tolerance,
            )
            if not matched:
                continue

            timestamp = datetime.now()
            label = f"MATCH {confidence:.1%}"
            draw_face_annotation(frame, location, label=label)

            snapshot_path: Optional[Path] = None
            if self._snapshot_count < self.max_snapshots:
                self.snapshot_dir.mkdir(parents=True, exist_ok=True)
                snapshot_path = self.snapshot_dir / (
                    f"{self.camera.camera_id}_{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
                )
                cv2.imwrite(str(snapshot_path), frame)
                self._snapshot_count += 1

            self.alert_manager.alert_match(
                camera_id=self.camera.camera_id,
                timestamp=timestamp,
                confidence=confidence,
                snapshot_path=snapshot_path,
            )
