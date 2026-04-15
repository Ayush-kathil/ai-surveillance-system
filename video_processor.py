"""Video feed processing pipeline for CCTV camera streams."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from threading import Event
from typing import Optional

import cv2
import numpy as np

import config
from alerts import AlertManager
from face_utils import detect_and_encode_faces, draw_face_annotation, find_best_match


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
        self.frame_skip = max(1, frame_skip)
        self.show_window = show_window
        self.realtime_delay_ms = max(1, realtime_delay_ms)
        self.snapshot_dir = Path(snapshot_dir)
        self.max_snapshots = max_snapshots
        self.stop_event = stop_event
        self._snapshot_count = 0

        self.consecutive_matches = 0
        self.last_alert_time = datetime.min

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

        match = find_best_match(self.target_encoding, locations, encodings)

        is_match = False
        if match:
            if match.weighted_score >= config.CONFIDENCE_THRESHOLD and \
               match.cosine_similarity >= config.COSINE_THRESHOLD and \
               match.euclidean_distance <= config.EUCLIDEAN_THRESHOLD:
                is_match = True

        if is_match and match:
            self.consecutive_matches += 1
            label = f"MATCH {match.weighted_score:.1%}"
            draw_face_annotation(frame, match.location, label=label, color=(0, 255, 0))

            if self.consecutive_matches >= config.STABILITY_FRAMES:
                now = datetime.now()
                cooldown_delta = timedelta(seconds=config.COOLDOWN_SECONDS)
                if now - self.last_alert_time >= cooldown_delta:
                    # Trigger alert
                    self.last_alert_time = now
                    
                    snapshot_path: Optional[Path] = None
                    if self._snapshot_count < self.max_snapshots:
                        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
                        snapshot_path = self.snapshot_dir / (
                            f"{self.camera.camera_id}_{now.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
                        )
                        cv2.imwrite(str(snapshot_path), frame)
                        self._snapshot_count += 1

                    self.alert_manager.alert_match(
                        camera_id=self.camera.camera_id,
                        timestamp=now,
                        confidence=match.weighted_score,
                        snapshot_path=snapshot_path,
                    )
        else:
            self.consecutive_matches = max(0, self.consecutive_matches - 1)
