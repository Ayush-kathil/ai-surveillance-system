from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import cv2
import numpy as np
from celery import Celery

from engine import analyze_video_alerts

REDIS_BROKER_URL = os.getenv("REDIS_BROKER_URL", "redis://localhost:6379/0")
REDIS_RESULT_BACKEND = os.getenv("REDIS_RESULT_BACKEND", REDIS_BROKER_URL)

celery_app = Celery(
    "surveillance_tasks",
    broker=REDIS_BROKER_URL,
    backend=REDIS_RESULT_BACKEND,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


def _video_frame_count(video_path: str) -> int:
    cap = cv2.VideoCapture(video_path)
    try:
        if not cap.isOpened():
            return 0
        return int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    finally:
        cap.release()


def _is_ml_critical_error(error: Exception) -> bool:
    message = str(error).lower()
    signatures = [
        "out of memory",
        "cuda out of memory",
        "memoryerror",
        "cannot allocate",
        "failed to load",
        "weights",
        "deepface",
        "yolo",
        "model",
    ]
    return any(signature in message for signature in signatures)


@celery_app.task(bind=True, name="tasks.analyze_surveillance")
def analyze_surveillance_task(
    self,
    *,
    session_id: str,
    cam1_path: str,
    cam2_path: str,
    target_encoding: list[float],
    profile: str = "balanced",
) -> dict[str, Any]:
    target = np.asarray(target_encoding, dtype=np.float32)

    cam1_total = _video_frame_count(cam1_path)
    cam2_total = _video_frame_count(cam2_path)
    total_frames = max(1, cam1_total + cam2_total)

    alerts: list[dict[str, Any]] = []
    lock = threading.Lock()
    emit_lock = threading.Lock()
    last_emit_time = 0.0

    progress: dict[str, Any] = {
        "state": "running",
        "session_id": session_id,
        "current_camera": "CAM-1",
        "processed_frames": 0,
        "total_frames": total_frames,
        "progress_percent": 0,
        "alerts_count": 0,
        "alerts": [],
        "latest_boxes": {
            "CAM-1": None,
            "CAM-2": None,
        },
        "started_at": time.time(),
        "profile": profile,
    }

    def emit_state(force: bool = False) -> None:
        nonlocal last_emit_time
        with emit_lock:
            now = time.monotonic()
            if not force and now - last_emit_time < 0.35:
                return

            total = max(1, int(progress["total_frames"]))
            processed = max(0, min(total, int(progress["processed_frames"])))
            progress["progress_percent"] = min(100, int((processed / total) * 100))
            self.update_state(state="PROGRESS", meta=dict(progress))
            last_emit_time = now

    def on_frame_progress(payload: dict[str, Any]) -> None:
        camera = str(payload.get("camera") or "CAM-1")
        with lock:
            progress["current_camera"] = camera
            progress["latest_boxes"][camera] = {
                "camera": camera,
                "frame_index": int(payload.get("frame_index") or 0),
                "bbox": payload.get("latest_box"),
                "track_id": payload.get("track_id"),
                "score": payload.get("score"),
            }
        emit_state()

    def run_camera(camera_id: str, path: str) -> None:
        local_alerts: list[dict[str, Any]] = []
        local_progress = {
            "processed_frames": 0,
            "total_frames": max(1, _video_frame_count(path)),
            "current_camera": camera_id,
        }

        def wrapped_progress(frame_payload: dict[str, Any]) -> None:
            with lock:
                progress["processed_frames"] = min(
                    int(progress["processed_frames"]) + 1,
                    int(progress["total_frames"]),
                )
                progress["current_camera"] = camera_id
            on_frame_progress(frame_payload)

        def on_alert(alert_payload: dict[str, Any]) -> None:
            with lock:
                alerts.append(alert_payload)
                progress["alerts_count"] = len(alerts)
                progress["alerts"] = alerts[-40:]
            emit_state(force=True)

        try:
            analyze_video_alerts(
                path,
                camera_id,
                target,
                local_alerts,
                profile=profile,
                progress=local_progress,
                progress_callback=wrapped_progress,
                alert_callback=on_alert,
            )
        except Exception as exc:
            with lock:
                progress["state"] = "error"
                progress["current_camera"] = camera_id
                progress["error"] = (
                    f"Critical ML error on {camera_id}: {exc}"
                    if _is_ml_critical_error(exc)
                    else f"Camera pipeline error on {camera_id}: {exc}"
                )
            self.update_state(state="ERROR", meta=dict(progress))
            raise RuntimeError(progress["error"]) from exc

    try:
        self.update_state(state="STARTED", meta=dict(progress))
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(run_camera, "CAM-1", cam1_path),
                executor.submit(run_camera, "CAM-2", cam2_path),
            ]
            for future in futures:
                future.result()

        alerts.sort(key=lambda alert: (alert.get("timestamp", ""), alert.get("camera", "")))
        result = {
            "state": "completed",
            "session_id": session_id,
            "progress_percent": 100,
            "processed_frames": total_frames,
            "total_frames": total_frames,
            "alerts_count": len(alerts),
            "alerts": alerts,
            "profile": profile,
            "completed_at": time.time(),
        }
        return result
    except Exception as exc:
        failure = {
            "state": "failed",
            "session_id": session_id,
            "error": str(exc),
            "progress_percent": progress.get("progress_percent", 0),
            "processed_frames": progress.get("processed_frames", 0),
            "total_frames": progress.get("total_frames", 1),
            "alerts_count": len(alerts),
            "alerts": alerts,
            "profile": profile,
        }
        self.update_state(state="FAILURE", meta=failure)
        raise
