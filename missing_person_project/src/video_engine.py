"""Video processing engine for per-camera missing person detection."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from threading import Event

import cv2
import numpy as np

from alert_system import AlertSystem
from face_engine import FaceEngine


@dataclass
class CameraConfig:
    camera_id: str
    source: Path


class VideoEngine:
    """Processes a single CCTV feed with stability checks and cooldown."""

    def __init__(
        self,
        camera: CameraConfig,
        face_engine: FaceEngine,
        alert_system: AlertSystem,
        reference_encoding: np.ndarray,
        confidence_threshold: float,
        cosine_threshold: float,
        euclidean_threshold: float,
        stability_frames: int,
        cooldown_seconds: int,
        initial_frame_skip: int,
        max_frame_skip: int,
        target_processing_ms: float,
        show_window: bool,
        window_wait_ms: int,
        stop_event: Event,
    ) -> None:
        self.camera = camera
        self.face_engine = face_engine
        self.alert_system = alert_system
        self.reference_encoding = reference_encoding

        self.confidence_threshold = confidence_threshold
        self.cosine_threshold = cosine_threshold
        self.euclidean_threshold = euclidean_threshold
        self.stability_frames = stability_frames
        self.cooldown_delta = timedelta(seconds=cooldown_seconds)

        self.frame_skip = max(1, initial_frame_skip)
        self.max_frame_skip = max(self.frame_skip, max_frame_skip)
        self.target_processing_ms = target_processing_ms

        self.show_window = show_window
        self.window_wait_ms = max(1, window_wait_ms)
        self.stop_event = stop_event

        self._consecutive_hits = 0
        self._last_alert_time: datetime | None = None

    def run(self) -> None:
        cap = cv2.VideoCapture(str(self.camera.source))
        if not cap.isOpened():
            print(f"Error: could not open video source {self.camera.source}")
            return

        window_name = f"{self.camera.camera_id} - CCTV"
        if self.show_window:
            cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

        frame_idx = 0
        try:
            while not self.stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    break

                frame_idx += 1
                should_process = frame_idx % self.frame_skip == 0

                if should_process:
                    t0 = time.perf_counter()
                    self._process_frame(frame, cap)
                    elapsed_ms = (time.perf_counter() - t0) * 1000.0
                    self._adapt_frame_skip(elapsed_ms)

                overlay = frame.copy()
                self._draw_overlay(overlay)

                if self.show_window:
                    cv2.imshow(window_name, overlay)
                    if cv2.waitKey(self.window_wait_ms) & 0xFF == ord("q"):
                        self.stop_event.set()
                        break
        finally:
            cap.release()
            if self.show_window:
                cv2.destroyWindow(window_name)

    def _process_frame(self, frame: np.ndarray, cap: cv2.VideoCapture) -> None:
        locations, encodings = self.face_engine.detect_and_encode(frame)
        best = self.face_engine.find_best_match(self.reference_encoding, locations, encodings)

        if best is None:
            self._consecutive_hits = 0
            return

        # Use weighted score as primary metric, with thresholds as backup
        hit = (
            best.weighted_score >= self.confidence_threshold
            or (
                best.cosine_similarity >= self.cosine_threshold
                and best.euclidean_distance <= self.euclidean_threshold
            )
        )
        
        if hit:
            self._consecutive_hits += 1
        else:
            self._consecutive_hits = 0

        color = (0, 0, 255) if hit else (0, 165, 255)
        label = f"score={best.weighted_score:.2f} stable={self._consecutive_hits}/{self.stability_frames}"
        self.face_engine.draw_label(frame, best.location, label, color)

        if not self._is_confirmed_hit(hit):
            return

        event_time = datetime.now()
        video_ts = self._video_timestamp(cap)

        self.face_engine.draw_label(
            frame,
            best.location,
            f"CONFIRMED {best.weighted_score:.2f} @ {video_ts}",
            (0, 0, 255),
        )
        self.alert_system.emit_detection(
            camera_id=self.camera.camera_id,
            confidence=best.weighted_score,
            cosine_sim=best.cosine_similarity,
            euclidean_dist=best.euclidean_distance,
            frame=frame,
            event_time=event_time,
            video_timestamp=video_ts,
        )
        self._last_alert_time = event_time
        self._consecutive_hits = 0

    def _is_confirmed_hit(self, current_hit: bool) -> bool:
        if not current_hit:
            return False

        if self._consecutive_hits < self.stability_frames:
            return False

        if self._last_alert_time is None:
            return True

        return (datetime.now() - self._last_alert_time) >= self.cooldown_delta

    def _draw_overlay(self, frame: np.ndarray) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        text = f"{self.camera.camera_id} | {timestamp} | skip={self.frame_skip}"
        cv2.putText(
            frame,
            text,
            (12, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 255),
            2,
            cv2.LINE_AA,
        )

    @staticmethod
    def _video_timestamp(cap: cv2.VideoCapture) -> str:
        ms = max(0.0, float(cap.get(cv2.CAP_PROP_POS_MSEC)))
        seconds = int(ms // 1000)
        hh = seconds // 3600
        mm = (seconds % 3600) // 60
        ss = seconds % 60
        return f"{hh:02d}:{mm:02d}:{ss:02d}"

    def _adapt_frame_skip(self, elapsed_ms: float) -> None:
        if elapsed_ms > self.target_processing_ms and self.frame_skip < self.max_frame_skip:
            self.frame_skip += 1
            return

        if elapsed_ms < (self.target_processing_ms * 0.60) and self.frame_skip > 1:
            self.frame_skip -= 1
