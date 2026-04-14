"""Face encoding and matching helpers."""

from __future__ import annotations

from pathlib import Path
from typing import List, Sequence, Tuple

import cv2
import face_recognition
import numpy as np


def load_missing_person_encoding(
    image_path: Path,
    model: str,
    upsample_times: int,
) -> np.ndarray:
    """Load and encode the target missing person's face from image."""
    image_path = Path(image_path)
    if not image_path.exists():
        raise FileNotFoundError(f"Missing person image not found: {image_path}")

    image = face_recognition.load_image_file(str(image_path))
    locations = face_recognition.face_locations(
        image, number_of_times_to_upsample=upsample_times, model=model
    )
    encodings = face_recognition.face_encodings(image, known_face_locations=locations)

    if not encodings:
        raise ValueError(
            "No face found in missing person image. Please provide a clear frontal image."
        )

    if len(encodings) > 1:
        print(
            "Warning: Multiple faces found in missing person image. "
            "Using the first detected face."
        )

    return encodings[0]


def detect_and_encode_faces(
    frame_bgr: np.ndarray,
    model: str,
    upsample_times: int,
) -> Tuple[List[Tuple[int, int, int, int]], List[np.ndarray]]:
    """Detect all faces in a frame and return locations with encodings."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(
        rgb, number_of_times_to_upsample=upsample_times, model=model
    )
    encodings = face_recognition.face_encodings(rgb, known_face_locations=locations)
    return locations, encodings


def match_face(
    target_encoding: np.ndarray,
    candidate_encoding: np.ndarray,
    tolerance: float,
) -> Tuple[bool, float]:
    """Compare a candidate encoding against target encoding."""
    distance = face_recognition.face_distance([target_encoding], candidate_encoding)[0]
    matched = bool(distance <= tolerance)
    confidence = max(0.0, min(1.0, 1.0 - float(distance)))
    return matched, confidence


def draw_face_annotation(
    frame: np.ndarray,
    location: Sequence[int],
    label: str,
    color: Tuple[int, int, int] = (0, 0, 255),
) -> None:
    """Draw a labeled face bounding box on frame."""
    top, right, bottom, left = location
    cv2.rectangle(frame, (left, top), (right, bottom), color, 2)

    text_bg_top = max(0, top - 24)
    cv2.rectangle(frame, (left, text_bg_top), (right, top), color, cv2.FILLED)
    cv2.putText(
        frame,
        label,
        (left + 6, max(16, top - 7)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255, 255, 255),
        1,
        cv2.LINE_AA,
    )
