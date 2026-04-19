"""High-speed missing-person detection engine."""

from __future__ import annotations

import os
import warnings
import time
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

try:
    import torch
except Exception:
    torch = None

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault("ABSL_MIN_LOG_LEVEL", "2")

warnings.filterwarnings(
    "ignore",
    message=r"From .*tf_keras.*sparse_softmax_cross_entropy.*deprecated.*",
    category=UserWarning,
)

import cv2
import numpy as np
from deepface import DeepFace
from ultralytics import YOLO

FACE_MODEL_NAME = os.getenv("FACE_MODEL_NAME", "Facenet512")
FACE_DETECTOR_BACKEND = os.getenv("FACE_DETECTOR_BACKEND", "opencv")
PERSON_CLASS_ID = 0
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.85"))
FACE_CONFIDENCE_THRESHOLD = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.60"))
YOLO_CONFIDENCE = float(os.getenv("YOLO_CONFIDENCE", "0.35"))
YOLO_IMAGE_SIZE = int(os.getenv("YOLO_IMAGE_SIZE", "640"))
MAX_PERSONS_PER_FRAME = int(os.getenv("MAX_PERSONS_PER_FRAME", "3"))
MAX_FRAME_WIDTH = int(os.getenv("MAX_FRAME_WIDTH", "960"))
PERSON_CROP_PADDING = int(os.getenv("PERSON_CROP_PADDING", "24"))
MATCH_RESET_FRAMES = max(1, int(os.getenv("MATCH_RESET_FRAMES", "4")))
MATCH_CONFIRM_FRAMES = max(1, int(os.getenv("MATCH_CONFIRM_FRAMES", "1")))
BASE_FRAME_STRIDE = max(1, int(os.getenv("BASE_FRAME_STRIDE", "1")))
HIGH_FPS_THRESHOLD = float(os.getenv("HIGH_FPS_THRESHOLD", "24"))
HIGH_FPS_STRIDE = max(BASE_FRAME_STRIDE, int(os.getenv("HIGH_FPS_STRIDE", "2")))
SNAPSHOT_DIR = Path(os.getenv("MATCH_SNAPSHOT_DIR", "output/snapshots"))
YOLO_DEVICE = 0 if torch is not None and torch.cuda.is_available() else "cpu"
YOLO_HALF = bool(torch is not None and torch.cuda.is_available())
SEGMENT_SECONDS = float(os.getenv("SEGMENT_SECONDS", "5"))

PROFILE_PRESETS: dict[str, dict[str, float]] = {
    "fast": {
        "match_threshold": max(0.75, MATCH_THRESHOLD - 0.05),
        "yolo_confidence": max(0.25, YOLO_CONFIDENCE - 0.05),
        "base_stride": max(2, BASE_FRAME_STRIDE),
        "confirm_frames": max(1, MATCH_CONFIRM_FRAMES - 1),
    },
    "balanced": {
        "match_threshold": MATCH_THRESHOLD,
        "yolo_confidence": YOLO_CONFIDENCE,
        "base_stride": BASE_FRAME_STRIDE,
        "confirm_frames": MATCH_CONFIRM_FRAMES,
    },
    "accurate": {
        "match_threshold": min(0.95, MATCH_THRESHOLD + 0.03),
        "yolo_confidence": min(0.7, YOLO_CONFIDENCE + 0.05),
        "base_stride": 1,
        "confirm_frames": max(2, MATCH_CONFIRM_FRAMES + 1),
    },
}


@dataclass
class FaceMatch:
    location: Tuple[int, int, int, int]
    similarity: float
    euclidean_distance: float


@dataclass
class MatchAlert:
    camera: str
    timestamp: str
    video_timestamp: str
    score: float
    euclidean_distance: float
    snapshot: str
    bounding_box: Tuple[int, int, int, int] | None


_yolo_model: YOLO | None = None


def get_profile_config(profile: str | None) -> dict[str, float]:
    normalized = (profile or "balanced").strip().lower()
    return PROFILE_PRESETS.get(normalized, PROFILE_PRESETS["balanced"])


def _build_segments(total_frames: int, fps: float, segment_seconds: float = SEGMENT_SECONDS) -> list[tuple[int, int]]:
    if total_frames <= 0:
        return [(0, -1)]

    segment_len = max(1, int(fps * max(1.0, segment_seconds)))
    segments: list[tuple[int, int]] = []
    start = 0
    while start < total_frames:
        end = min(total_frames - 1, start + segment_len - 1)
        segments.append((start, end))
        start = end + 1
    return segments


def _normalize(embedding: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(embedding))
    if norm == 0.0:
        return embedding.astype(np.float32, copy=False)
    return (embedding / norm).astype(np.float32, copy=False)


def _resolve_yolo_model_path() -> Path:
    candidates = [
        os.getenv("YOLO_MODEL_PATH"),
        "backend/yolov12n.engine",
        "yolov12n.engine",
        "backend/yolov12n_openvino_model",
        "yolov12n_openvino_model",
        "backend/yolov12n.pt",
        "yolov12n.pt",
        "backend/yolov8n.pt",
        "yolov8n.pt",
    ]

    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate)
        if path.exists():
            return path

    raise FileNotFoundError(
        "No YOLO weights found. Place yolov12n.pt, yolov12n.engine, or yolov12n_openvino_model/ "
        "in the workspace, or keep the existing yolov8n.pt fallback."
    )


def get_yolo_model() -> YOLO:
    global _yolo_model
    if _yolo_model is None:
        _yolo_model = YOLO(str(_resolve_yolo_model_path()))
        try:
            _yolo_model.fuse()
        except Exception:
            pass
    return _yolo_model


def warm_up_models() -> None:
    DeepFace.build_model(FACE_MODEL_NAME)
    get_yolo_model()


def _represent_face(image: np.ndarray, detector_backend: str, enforce_detection: bool) -> list[dict[str, Any]]:
    return DeepFace.represent(
        img_path=image,
        model_name=FACE_MODEL_NAME,
        detector_backend=detector_backend,
        enforce_detection=enforce_detection,
        align=True,
    )


def _extract_embedding(image: np.ndarray, *, enforce_detection: bool) -> np.ndarray:
    results = _represent_face(
        image,
        detector_backend=FACE_DETECTOR_BACKEND,
        enforce_detection=enforce_detection,
    )

    if not results:
        raise ValueError("No face could be extracted from the supplied image.")

    best_result: dict[str, Any] | None = None
    best_confidence = -1.0

    for result in results:
        embedding = result.get("embedding")
        if embedding is None:
            continue

        confidence = float(result.get("face_confidence") or 0.0)
        if confidence > best_confidence:
            best_confidence = confidence
            best_result = result

    if best_result is None:
        raise ValueError("No usable face embedding was returned.")

    if not enforce_detection and best_confidence < FACE_CONFIDENCE_THRESHOLD:
        raise ValueError("Detected face confidence is too low for matching.")

    return _normalize(np.asarray(best_result["embedding"], dtype=np.float32))


def load_encoding_from_image(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image")

    try:
        return _extract_embedding(image, enforce_detection=True)
    except Exception as exc:
        raise ValueError(f"Could not extract facial features from reference image: {exc}") from exc


def cosine_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    a = _normalize(embedding1)
    b = _normalize(embedding2)
    return float(np.clip(np.dot(a, b), -1.0, 1.0))


def euclidean_distance(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    a = _normalize(embedding1)
    b = _normalize(embedding2)
    return float(np.linalg.norm(a - b))


def _expand_crop(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> np.ndarray:
    top = max(0, y1 - PERSON_CROP_PADDING)
    left = max(0, x1 - PERSON_CROP_PADDING)
    bottom = min(frame.shape[0], y2 + PERSON_CROP_PADDING)
    right = min(frame.shape[1], x2 + PERSON_CROP_PADDING)
    return frame[top:bottom, left:right]


def _save_match_snapshot(
    frame: np.ndarray,
    camera_id: str,
    timestamp: datetime,
    location: tuple[int, int, int, int] | None = None,
) -> Path:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_path = SNAPSHOT_DIR / f"{camera_id}_{timestamp.strftime('%Y%m%d_%H%M%S_%f')}.jpg"

    marked_frame = frame.copy()
    if location is not None:
        x1, y1, x2, y2 = location
        x1 = max(0, min(int(x1), marked_frame.shape[1] - 1))
        y1 = max(0, min(int(y1), marked_frame.shape[0] - 1))
        x2 = max(0, min(int(x2), marked_frame.shape[1] - 1))
        y2 = max(0, min(int(y2), marked_frame.shape[0] - 1))
        cv2.rectangle(marked_frame, (x1, y1), (x2, y2), (0, 255, 255), 4)
        label_y = max(18, y1 - 10)
        cv2.rectangle(marked_frame, (x1, max(0, y1 - 24)), (min(marked_frame.shape[1] - 1, x1 + 160), y1), (0, 255, 255), -1)
        cv2.putText(marked_frame, "DETECTED PERSON", (x1 + 6, label_y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2, cv2.LINE_AA)

    cv2.imwrite(str(snapshot_path), marked_frame)
    return snapshot_path


def _append_match_alert(
    alerts_list: list,
    *,
    camera_id: str,
    score: float,
    euclidean_dist: float,
    event_time: datetime,
    video_timestamp: str,
    frame: np.ndarray,
    location: tuple[int, int, int, int] | None = None,
) -> None:
    snapshot_path = _save_match_snapshot(frame, camera_id, event_time, location)
    alert = MatchAlert(
        camera=camera_id,
        timestamp=event_time.isoformat(sep=" ", timespec="seconds"),
        video_timestamp=video_timestamp,
        score=round(score, 4),
        euclidean_distance=round(euclidean_dist, 4),
        snapshot=snapshot_path.name,
        bounding_box=location,
    )
    alerts_list.append(alert.__dict__)


def _detect_candidates(
    frame: np.ndarray,
    *,
    yolo_confidence: float,
) -> list[tuple[float, tuple[int, int, int, int], np.ndarray]]:
    detections = get_yolo_model().predict(
        frame,
        classes=[PERSON_CLASS_ID],
        conf=yolo_confidence,
        imgsz=YOLO_IMAGE_SIZE,
        device=YOLO_DEVICE,
        half=YOLO_HALF,
        verbose=False,
    )

    candidates: list[tuple[float, tuple[int, int, int, int], np.ndarray]] = []
    for result in detections:
        for box in result.boxes:
            class_id = int(box.cls[0])
            if class_id != PERSON_CLASS_ID:
                continue

            confidence = float(box.conf[0])
            if confidence < yolo_confidence:
                continue

            x1, y1, x2, y2 = map(int, box.xyxy[0])
            crop = _expand_crop(frame, x1, y1, x2, y2)
            if crop.size == 0:
                continue

            try:
                embedding = _extract_embedding(crop, enforce_detection=False)
            except Exception:
                continue

            candidates.append((confidence, (x1, y1, x2, y2), embedding))

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates


def _best_match_from_candidates(
    candidates: list[tuple[float, tuple[int, int, int, int], np.ndarray]],
    target_encoding: np.ndarray,
) -> FaceMatch | None:
    best_match: FaceMatch | None = None
    for _, (x1, y1, x2, y2), candidate_embedding in candidates[:MAX_PERSONS_PER_FRAME]:
        similarity = cosine_similarity(target_encoding, candidate_embedding)
        distance = euclidean_distance(target_encoding, candidate_embedding)

        if best_match is None or similarity > best_match.similarity:
            best_match = FaceMatch(
                location=(x1, y1, x2, y2),
                similarity=similarity,
                euclidean_distance=distance,
            )
    return best_match


def analyze_video_alerts(
    video_path: str,
    camera_id: str,
    target_encoding: np.ndarray,
    alerts_list: list,
    *,
    profile: str,
    progress: dict[str, Any] | None = None,
    progress_lock: threading.Lock | None = None,
) -> None:
    profile_config = get_profile_config(profile)
    match_threshold = float(profile_config["match_threshold"])
    yolo_confidence = float(profile_config["yolo_confidence"])
    base_stride = max(1, int(profile_config["base_stride"]))
    confirm_frames = max(1, int(profile_config["confirm_frames"]))

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    adaptive_stride = max(base_stride, HIGH_FPS_STRIDE if fps >= HIGH_FPS_THRESHOLD else base_stride)

    match_active = False
    match_streak = 0
    non_match_streak = 0
    frame_index = 0

    segments = _build_segments(total_frames, fps)

    try:
        for start_frame, end_frame in segments:
            if start_frame > 0:
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            local_index = start_frame
            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                frame_index += 1
                local_index += 1
                if end_frame >= 0 and local_index > end_frame:
                    break

                if frame.shape[1] > MAX_FRAME_WIDTH:
                    scale = MAX_FRAME_WIDTH / frame.shape[1]
                    frame = cv2.resize(frame, (MAX_FRAME_WIDTH, int(frame.shape[0] * scale)))

                should_run_detection = True
                if not match_active and adaptive_stride > 1:
                    should_run_detection = ((frame_index - 1) % adaptive_stride) == 0

                best_match: FaceMatch | None = None
                if should_run_detection:
                    candidates = _detect_candidates(frame, yolo_confidence=yolo_confidence)
                    best_match = _best_match_from_candidates(candidates, target_encoding)

                is_match = bool(best_match and best_match.similarity >= match_threshold)
                if is_match and best_match is not None:
                    match_streak += 1
                    non_match_streak = 0
                    if (not match_active) and match_streak >= confirm_frames:
                        match_active = True
                        event_time = datetime.now()
                        video_timestamp = str(timedelta(seconds=int(frame_index / fps)))
                        _append_match_alert(
                            alerts_list,
                            camera_id=camera_id,
                            score=best_match.similarity,
                            euclidean_dist=best_match.euclidean_distance,
                            event_time=event_time,
                            video_timestamp=video_timestamp,
                            frame=frame,
                            location=best_match.location,
                        )
                else:
                    match_streak = 0
                    non_match_streak += 1
                    if non_match_streak >= MATCH_RESET_FRAMES:
                        match_active = False

                if progress is not None:
                    if progress_lock is not None:
                        with progress_lock:
                            progress["processed_frames"] = min(
                                int(progress.get("processed_frames", 0)) + 1,
                                int(progress.get("total_frames", 1)),
                            )
                            progress["current_camera"] = camera_id
                    else:
                        progress["processed_frames"] = min(
                            int(progress.get("processed_frames", 0)) + 1,
                            int(progress.get("total_frames", 1)),
                        )
                        progress["current_camera"] = camera_id
    finally:
        cap.release()


def yield_raw_video_frames(video_path: str):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Cannot open video {video_path}")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame.shape[1] > MAX_FRAME_WIDTH:
                scale = MAX_FRAME_WIDTH / frame.shape[1]
                frame = cv2.resize(frame, (MAX_FRAME_WIDTH, int(frame.shape[0] * scale)))

            ret, buffer = cv2.imencode(".jpg", frame)
            if not ret:
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            )
    finally:
        cap.release()


def yield_video_frames(video_path: str, camera_id: str, target_encoding: np.ndarray, alerts_list: list):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Cannot open video {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_index = 0
    match_active = False
    match_streak = 0
    non_match_streak = 0
    adaptive_stride = HIGH_FPS_STRIDE if fps >= HIGH_FPS_THRESHOLD else BASE_FRAME_STRIDE

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            frame_index += 1

            # Skip heavy face inference for some frames to improve throughput.
            # When a possible match is active, process every frame to preserve accuracy.
            should_run_detection = True
            if not match_active and adaptive_stride > 1:
                should_run_detection = ((frame_index - 1) % adaptive_stride) == 0

            if frame.shape[1] > MAX_FRAME_WIDTH:
                scale = MAX_FRAME_WIDTH / frame.shape[1]
                frame = cv2.resize(frame, (MAX_FRAME_WIDTH, int(frame.shape[0] * scale)))

            candidates: list[tuple[float, tuple[int, int, int, int], np.ndarray]] = []
            if should_run_detection:
                detections = get_yolo_model().predict(
                    frame,
                    classes=[PERSON_CLASS_ID],
                    conf=YOLO_CONFIDENCE,
                    imgsz=YOLO_IMAGE_SIZE,
                    device=YOLO_DEVICE,
                    half=YOLO_HALF,
                    verbose=False,
                )

                for result in detections:
                    for box in result.boxes:
                        class_id = int(box.cls[0])
                        if class_id != PERSON_CLASS_ID:
                            continue

                        confidence = float(box.conf[0])
                        if confidence < YOLO_CONFIDENCE:
                            continue

                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        crop = _expand_crop(frame, x1, y1, x2, y2)
                        if crop.size == 0:
                            continue

                        try:
                            embedding = _extract_embedding(crop, enforce_detection=False)
                        except Exception:
                            continue

                        candidates.append((confidence, (x1, y1, x2, y2), embedding))

            candidates.sort(key=lambda item: item[0], reverse=True)
            best_match: FaceMatch | None = None

            for _, (x1, y1, x2, y2), candidate_embedding in candidates[:MAX_PERSONS_PER_FRAME]:
                similarity = cosine_similarity(target_encoding, candidate_embedding)
                distance = euclidean_distance(target_encoding, candidate_embedding)

                if best_match is None or similarity > best_match.similarity:
                    best_match = FaceMatch(
                        location=(x1, y1, x2, y2),
                        similarity=similarity,
                        euclidean_distance=distance,
                    )

                color = (0, 255, 0) if similarity >= MATCH_THRESHOLD else (0, 0, 255)
                label = f"person | sim={similarity:.2f} | dist={distance:.2f}"
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(
                    frame,
                    label,
                    (x1, max(16, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.48,
                    color,
                    2,
                )

            is_match = bool(best_match and best_match.similarity >= MATCH_THRESHOLD)

            if is_match and best_match is not None:
                match_streak += 1
                non_match_streak = 0
                if not match_active and match_streak >= MATCH_CONFIRM_FRAMES:
                    match_active = True
                    event_time = datetime.now()
                    video_timestamp = str(timedelta(seconds=int(frame_index / fps)))
                    _append_match_alert(
                        alerts_list,
                        camera_id=camera_id,
                        score=best_match.similarity,
                        euclidean_dist=best_match.euclidean_distance,
                        event_time=event_time,
                        video_timestamp=video_timestamp,
                        frame=frame,
                        location=best_match.location,
                    )
            else:
                match_streak = 0
                non_match_streak += 1
                if non_match_streak >= MATCH_RESET_FRAMES:
                    match_active = False

            ret, buffer = cv2.imencode(".jpg", frame)
            if not ret:
                continue

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"
            )
    finally:
        cap.release()

