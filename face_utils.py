"""Face encoding and matching helpers."""

from __future__ import annotations

from pathlib import Path
from typing import List, Sequence, Tuple, Optional
from dataclasses import dataclass

import cv2
import face_recognition
import numpy as np
from scipy.spatial.distance import euclidean

@dataclass
class FaceMatch:
    """Stores a single face match candidate."""
    location: Tuple[int, int, int, int]
    cosine_similarity: float
    euclidean_distance: float
    weighted_score: float  # Combined metric for better accuracy

def _normalize(encoding: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(encoding))
    if norm == 0.0:
        return encoding
    return encoding / norm

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
        # Fallback for low-resolution references: try enhanced variants.
        bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        variants: list[np.ndarray] = []
        for scale in (2, 3, 4):
            up = cv2.resize(
                bgr,
                None,
                fx=scale,
                fy=scale,
                interpolation=cv2.INTER_CUBIC,
            )
            variants.append(cv2.cvtColor(up, cv2.COLOR_BGR2RGB))

            gray = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY)
            eq = cv2.equalizeHist(gray)
            variants.append(cv2.cvtColor(eq, cv2.COLOR_GRAY2RGB))

        for variant in variants:
            v_locations = face_recognition.face_locations(
                variant,
                number_of_times_to_upsample=upsample_times,
                model=model,
            )
            v_encodings = face_recognition.face_encodings(
                variant,
                known_face_locations=v_locations,
            )
            if v_encodings:
                encodings = v_encodings
                break

    if not encodings:
        raise ValueError(
            "No face found in missing.jpg. Provide a clear frontal face image."
        )

    if len(encodings) > 1:
        print("Warning: Multiple faces in missing.jpg. Using first detected face.")

    return _normalize(encodings[0])

def detect_and_encode_faces(
    frame_bgr: np.ndarray,
    model: str,
    upsample_times: int,
) -> Tuple[List[Tuple[int, int, int, int]], List[np.ndarray]]:
    """Detect all faces in a frame and return locations with normalized encodings."""
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(
        rgb, number_of_times_to_upsample=upsample_times, model=model
    )
    encodings = face_recognition.face_encodings(rgb, known_face_locations=locations)
    normalized_encodings = [_normalize(enc) for enc in encodings]
    return locations, normalized_encodings

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    sim = float(np.dot(a, b))
    return max(-1.0, min(1.0, sim))

def find_best_match(
    reference_encoding: np.ndarray,
    locations: List[Tuple[int, int, int, int]],
    candidates: List[np.ndarray],
) -> Optional[FaceMatch]:
    if not candidates:
        return None

    best_idx = 0
    best_cosine = -2.0
    best_euclidean = float("inf")
    best_weighted = -2.0

    for idx, cand in enumerate(candidates):
        cosine = cosine_similarity(reference_encoding, cand)
        
        # Euclidean distance in normalized space: lower is better
        euclidean_dist = euclidean(reference_encoding, cand)
        
        # Weighted score: combine both metrics
        # Cosine weight: 0.7, Euclidean weight: 0.3 (inverted for distance)
        weighted = (cosine * 0.7) + ((1 - min(euclidean_dist / 2.0, 1.0)) * 0.3)
        
        if weighted > best_weighted:
            best_weighted = weighted
            best_idx = idx
            best_cosine = cosine
            best_euclidean = euclidean_dist

    return FaceMatch(
        location=locations[best_idx],
        cosine_similarity=best_cosine,
        euclidean_distance=best_euclidean,
        weighted_score=best_weighted,
    )

def match_face(
    target_encoding: np.ndarray,
    candidate_encoding: np.ndarray,
    tolerance: float,
) -> Tuple[bool, float]:
    """Legacy compare a candidate encoding against target encoding."""
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
