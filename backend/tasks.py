from __future__ import annotations

import os
import shutil
import time
from datetime import datetime, timedelta, UTC
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_process_init

from engine import SNAPSHOT_DIR, analyze_video_alerts, load_encoding_from_image, warm_up_models
from logger_config import logger

REDIS_BROKER_URL = os.getenv("REDIS_BROKER_URL", "redis://localhost:6379/0")
REDIS_RESULT_BACKEND = os.getenv("REDIS_RESULT_BACKEND", REDIS_BROKER_URL)
SHARED_SESSIONS_DIR = Path(os.getenv("SHARED_SESSIONS_DIR", "shared/sessions"))
DATA_RETENTION_HOURS = int(os.getenv("DATA_RETENTION_HOURS", "4"))

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
    result_expires=DATA_RETENTION_HOURS * 3600,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "cleanup-surveillance-artifacts-hourly": {
            "task": "tasks.cleanup_expired_surveillance_data",
            "schedule": crontab(minute=0),
        }
    },
)


@worker_process_init.connect
def _warm_models_on_worker_process(**_: Any) -> None:
    try:
        warm_up_models()
    except Exception as exc:
        logger.bind(event="worker_warmup_failed", error=str(exc)).warning(
            "Worker model warm-up failed; task execution will retry model load lazily"
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


def _is_expired(path: Path, cutoff: datetime) -> bool:
    modified_at = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
    return modified_at < cutoff


@celery_app.task(name="tasks.cleanup_expired_surveillance_data")
def cleanup_expired_surveillance_data() -> dict[str, int]:
    cutoff = datetime.now(tz=UTC) - timedelta(hours=DATA_RETENTION_HOURS)
    removed_sessions = 0
    removed_snapshots = 0

    if SHARED_SESSIONS_DIR.exists() and SHARED_SESSIONS_DIR.is_dir():
        for item in SHARED_SESSIONS_DIR.iterdir():
            try:
                if item.is_dir() and _is_expired(item, cutoff):
                    shutil.rmtree(item, ignore_errors=False)
                    removed_sessions += 1
            except Exception as exc:
                logger.bind(event="cleanup_error", path=str(item), error=str(exc)).warning(
                    "Failed to remove expired session directory"
                )

    if SNAPSHOT_DIR.exists() and SNAPSHOT_DIR.is_dir():
        for file_path in SNAPSHOT_DIR.iterdir():
            try:
                if file_path.is_file() and _is_expired(file_path, cutoff):
                    file_path.unlink(missing_ok=True)
                    removed_snapshots += 1
            except Exception as exc:
                logger.bind(event="cleanup_error", path=str(file_path), error=str(exc)).warning(
                    "Failed to remove expired snapshot"
                )

    logger.bind(
        event="cleanup_completed",
        removed_sessions=removed_sessions,
        removed_snapshots=removed_snapshots,
    ).info("Periodic surveillance cleanup completed")
    return {"removed_sessions": removed_sessions, "removed_snapshots": removed_snapshots}


@celery_app.task(bind=True, name="tasks.analyze_surveillance")
def analyze_surveillance_task(
    self,
    *,
    session_id: str,
    cam1_path: str,
    cam2_path: str,
    reference_image_path: str,
    profile: str = "balanced",
) -> dict[str, Any]:
    logger.bind(event="task_started", session_id=session_id, profile=profile).info(
        "Celery surveillance task started"
    )
    try:
        with open(reference_image_path, "rb") as ref_file:
            target = load_encoding_from_image(ref_file.read())
    except Exception as exc:
        raise RuntimeError(f"Reference image processing failed: {exc}") from exc

    cam1_total = _video_frame_count(cam1_path)
    cam2_total = _video_frame_count(cam2_path)
    total_frames = max(1, cam1_total + cam2_total)

    alerts: list[dict[str, Any]] = []
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

    def _safe_update_state(*, state: str, meta: dict[str, Any]) -> None:
        try:
            self.update_state(state=state, meta=meta)
        except Exception as exc:
            logger.bind(event="state_update_failed", state=state, error=str(exc)).warning(
                "Failed to publish task state update"
            )

    def emit_state(force: bool = False) -> None:
        nonlocal last_emit_time
        now = time.monotonic()
        if not force and now - last_emit_time < 0.35:
            return

        total = max(1, int(progress["total_frames"]))
        processed = max(0, min(total, int(progress["processed_frames"])))
        progress_percent = min(100, int((processed / total) * 100))
        if processed > 0 and progress_percent == 0:
            progress_percent = 1
        progress["progress_percent"] = progress_percent
        _safe_update_state(state="PROGRESS", meta=dict(progress))
        last_emit_time = now

    def on_frame_progress(payload: dict[str, Any]) -> None:
        camera = str(payload.get("camera") or "CAM-1")
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
            progress["processed_frames"] = min(
                int(progress["processed_frames"]) + 1,
                int(progress["total_frames"]),
            )
            progress["current_camera"] = camera_id
            on_frame_progress(frame_payload)

        def on_alert(alert_payload: dict[str, Any]) -> None:
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
            progress["state"] = "error"
            progress["current_camera"] = camera_id
            progress["error"] = (
                f"Critical ML error on {camera_id}: {exc}"
                if _is_ml_critical_error(exc)
                else f"Camera pipeline error on {camera_id}: {exc}"
            )
            _safe_update_state(state="ERROR", meta=dict(progress))
            raise RuntimeError(progress["error"]) from exc

    try:
        _safe_update_state(state="STARTED", meta=dict(progress))
        # Keep processing single-threaded inside the Celery task context so update_state
        # always has a valid request/task id.
        run_camera("CAM-1", cam1_path)
        run_camera("CAM-2", cam2_path)

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
        logger.bind(
            event="task_completed",
            session_id=session_id,
            alerts_count=len(alerts),
            total_frames=total_frames,
        ).info("Celery surveillance task completed")
        return result
    except Exception as exc:
        progress["state"] = "failed"
        progress["error"] = str(exc)
        emit_state(force=True)
        logger.bind(event="task_failed", session_id=session_id, error=str(exc)).exception(
            "Celery surveillance task failed"
        )
        raise
