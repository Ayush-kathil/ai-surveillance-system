"""Alerting, logging, and snapshot management."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from threading import Lock

import cv2
import numpy as np


@dataclass
class DetectionRecord:
    camera_id: str
    timestamp: datetime
    confidence: float
    snapshot_path: Path


class AlertSystem:
    """Thread-safe alert logger for detections."""

    def __init__(self, log_file: Path, snapshot_dir: Path) -> None:
        self.log_file = Path(log_file)
        self.snapshot_dir = Path(snapshot_dir)
        self._lock = Lock()

        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)
        self._init_log()

    def _init_log(self) -> None:
        start = datetime.now().isoformat(sep=" ", timespec="seconds")
        header = (
            "=" * 80
            + "\nMissing Person Detection Log\n"
            + f"Session Start: {start}\n"
            + "=" * 80
            + "\n"
        )
        with self.log_file.open("w", encoding="utf-8") as fp:
            fp.write(header)

    def save_snapshot(self, camera_id: str, frame: np.ndarray, timestamp: datetime) -> Path:
        name = f"{camera_id}_{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        snapshot_path = self.snapshot_dir / name
        cv2.imwrite(str(snapshot_path), frame)
        return snapshot_path

    def emit_detection(
        self,
        camera_id: str,
        confidence: float,
        frame: np.ndarray,
        event_time: datetime,
    ) -> DetectionRecord:
        snapshot_path = self.save_snapshot(camera_id, frame, event_time)
        record = DetectionRecord(
            camera_id=camera_id,
            timestamp=event_time,
            confidence=confidence,
            snapshot_path=snapshot_path,
        )

        line = (
            f"ALERT | camera={record.camera_id} | "
            f"time={record.timestamp.isoformat(sep=' ', timespec='seconds')} | "
            f"confidence={record.confidence:.3f} | "
            f"snapshot={record.snapshot_path}"
        )
        with self._lock:
            print(line)
            with self.log_file.open("a", encoding="utf-8") as fp:
                fp.write(line + "\n")

        return record
