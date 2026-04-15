import cv2
import face_recognition
import numpy as np
from scipy.spatial.distance import euclidean
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
from datetime import timedelta
import math

# --- Face Utilities ---
@dataclass
class FaceMatch:
    location: Tuple[int, int, int, int]
    cosine_similarity: float
    euclidean_distance: float
    weighted_score: float

def _normalize(encoding: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(encoding))
    if norm == 0.0: return encoding
    return encoding / norm

def load_encoding_from_image(image_bytes: bytes, model="hog", upsample_times=1) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image")
        
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(rgb, number_of_times_to_upsample=upsample_times, model=model)
    encodings = face_recognition.face_encodings(rgb, known_face_locations=locations)

    if not encodings:
        # Fallback variants for low resolution
        variants = []
        for scale in (2, 3, 4):
            up = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            variants.append(cv2.cvtColor(up, cv2.COLOR_BGR2RGB))
            gray = cv2.cvtColor(up, cv2.COLOR_BGR2GRAY)
            eq = cv2.equalizeHist(gray)
            variants.append(cv2.cvtColor(eq, cv2.COLOR_GRAY2RGB))
            
        for var in variants:
            locs = face_recognition.face_locations(var, number_of_times_to_upsample=upsample_times, model=model)
            encs = face_recognition.face_encodings(var, known_face_locations=locs)
            if encs:
                encodings = encs
                break

    if not encodings:
        raise ValueError("No face found in uploaded image.")
        
    return _normalize(encodings[0])

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    sim = float(np.dot(a, b))
    return max(-1.0, min(1.0, sim))

def find_best_match(reference: np.ndarray, locations: List[Tuple[int, int, int, int]], candidates: List[np.ndarray]) -> Optional[FaceMatch]:
    if not candidates: return None
    best_idx, best_cosine, best_euclidean, best_weighted = 0, -2.0, float('inf'), -2.0

    for idx, cand in enumerate(candidates):
        cosine = cosine_similarity(reference, cand)
        euc_dist = euclidean(reference, cand)
        weighted = (cosine * 0.7) + ((1 - min(euc_dist / 2.0, 1.0)) * 0.3)
        if weighted > best_weighted:
            best_weighted, best_idx, best_cosine, best_euclidean = weighted, idx, cosine, euc_dist

    return FaceMatch(locations[best_idx], best_cosine, best_euclidean, best_weighted)


# --- Video Processor ---
def process_video_feed(video_path: str, camera_id: str, target_encoding: np.ndarray, skip_frames=2) -> List[Dict[str, Any]]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Cannot open video {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or math.isnan(fps):
        fps = 30.0

    frame_index = 0
    consecutive_matches = 0
    detections = []
    
    # Constants
    CONFIDENCE_THRESHOLD = 0.55
    STABILITY_FRAMES = 2
    COOLDOWN_SECONDS = 5
    last_alert_seconds = -10.0
    
    while True:
        ok, frame = cap.read()
        if not ok: break

        frame_index += 1
        if frame_index % skip_frames != 0:
            continue

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        locs = face_recognition.face_locations(rgb, model="hog")
        encs = face_recognition.face_encodings(rgb, known_face_locations=locs)
        norm_encs = [_normalize(e) for e in encs]

        match = find_best_match(target_encoding, locs, norm_encs)
        is_match = False
        if match and match.weighted_score >= CONFIDENCE_THRESHOLD:
            is_match = True

        if is_match and match:
            consecutive_matches += 1
            if consecutive_matches >= STABILITY_FRAMES:
                current_seconds = frame_index / fps
                if current_seconds - last_alert_seconds >= COOLDOWN_SECONDS:
                    last_alert_seconds = current_seconds
                    # Format timestamp
                    td = timedelta(seconds=int(current_seconds))
                    detections.append({
                        "camera": camera_id,
                        "timestamp": str(td),
                        "score": round(match.weighted_score, 4)
                    })
        else:
            consecutive_matches = max(0, consecutive_matches - 1)

    cap.release()
    return detections
