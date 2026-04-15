"""Face detection and feature matching engine."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

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


class FaceEngine:
    """Encapsulates face detection and cosine-similarity based matching."""

    def __init__(self, model_preference: str = "auto", upsample_times: int = 0) -> None:
        self.upsample_times = upsample_times
        self.model = self._select_model(model_preference)

    def _select_model(self, preference: str) -> str:
        if preference == "cnn":
            return "cnn"
        if preference == "hog":
            return "hog"

        # auto mode: use cnn only when dlib indicates CUDA support.
        try:
            import dlib  # type: ignore

            if bool(getattr(dlib, "DLIB_USE_CUDA", False)):
                print("Face detection model: cnn (CUDA available)")
                return "cnn"
        except Exception:
            pass

        print("Face detection model: hog (fallback)")
        return "hog"

    @staticmethod
    def _normalize(encoding: np.ndarray) -> np.ndarray:
        norm = float(np.linalg.norm(encoding))
        if norm == 0.0:
            return encoding
        return encoding / norm

    def load_reference_encoding(self, image_path: Path) -> np.ndarray:
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Reference image not found: {image_path}")

        image = face_recognition.load_image_file(str(image_path))
        locations = face_recognition.face_locations(
            image, number_of_times_to_upsample=self.upsample_times, model=self.model
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
                    number_of_times_to_upsample=self.upsample_times,
                    model=self.model,
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

        return self._normalize(encodings[0])

    def detect_and_encode(
        self, frame_bgr: np.ndarray
    ) -> Tuple[List[Tuple[int, int, int, int]], List[np.ndarray]]:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(
            rgb, number_of_times_to_upsample=self.upsample_times, model=self.model
        )
        encodings = face_recognition.face_encodings(rgb, known_face_locations=locations)
        normalized = [self._normalize(enc) for enc in encodings]
        return locations, normalized

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        sim = float(np.dot(a, b))
        # keep the value in expected cosine bounds for numerical stability
        return max(-1.0, min(1.0, sim))

    def find_best_match(
        self,
        reference_encoding: np.ndarray,
        locations: List[Tuple[int, int, int, int]],
        candidates: List[np.ndarray],
    ) -> FaceMatch | None:
        if not candidates:
            return None

        best_idx = 0
        best_cosine = -2.0
        best_euclidean = float("inf")
        best_weighted = -2.0

        for idx, cand in enumerate(candidates):
            cosine = self.cosine_similarity(reference_encoding, cand)
            
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

    @staticmethod
    def draw_label(
        frame: np.ndarray,
        location: Tuple[int, int, int, int],
        text: str,
        color: Tuple[int, int, int],
    ) -> None:
        top, right, bottom, left = location
        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)

        text_top = max(0, top - 22)
        cv2.rectangle(frame, (left, text_top), (right, top), color, cv2.FILLED)
        cv2.putText(
            frame,
            text,
            (left + 5, max(15, top - 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )
