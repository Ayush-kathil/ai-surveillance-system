"""Alert and logging utilities."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Optional


class AlertManager:
    """Thread-safe alert logger for console and disk outputs."""

    def __init__(self, log_file: Path) -> None:
        self.log_file = Path(log_file)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._initialize_log()

    def _initialize_log(self) -> None:
        header = (
            "=" * 70
            + "\nMissing Person Detection Log\n"
            + f"Session Start: {datetime.now().isoformat(sep=' ', timespec='seconds')}\n"
            + "=" * 70
            + "\n"
        )
        with self.log_file.open("w", encoding="utf-8") as f:
            f.write(header)

    def alert_match(
        self,
        camera_id: str,
        timestamp: datetime,
        confidence: float,
        snapshot_path: Optional[Path] = None,
    ) -> None:
        message = (
            f"ALERT | Match Found | Camera: {camera_id} | "
            f"Timestamp: {timestamp.isoformat(sep=' ', timespec='seconds')} | "
            f"Confidence: {confidence:.2%}"
        )
        if snapshot_path is not None:
            message += f" | Snapshot: {snapshot_path}"

        with self._lock:
            print(message)
            with self.log_file.open("a", encoding="utf-8") as f:
                f.write(message + "\n")
