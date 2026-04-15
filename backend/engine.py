from deepface import DeepFace
import os
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Any
from datetime import timedelta
import math

# Set logging level for tensorflow to reduce noise
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# --- Configuration ---
RECOGNITION_MODEL = "ArcFace"  # 512-d embeddings, high accuracy
DETECTOR_BACKEND = "retinaface" # SOTA for face detection/alignment
DISTANCE_METRIC = "cosine"
THRESHOLD = 0.68 # ArcFace cosine threshold (0.68 is standard for balanced)

# --- Face Utilities ---
@dataclass
class FaceMatch:
    location: Dict[str, int]
    score: float

def load_encoding_from_image(image_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image")
    
    # Extract embedding using DeepFace
    # enforce_detection=True ensures we only proceed if a face is found
    try:
        results = DeepFace.represent(
            img_path=image, 
            model_name=RECOGNITION_MODEL, 
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True
        )
        # Returns a list of dicts. We take the first face.
        return np.array(results[0]["embedding"])
    except Exception as e:
        # Fallback for low-res or difficult reference images
        raise ValueError(f"Could not extract facial features from reference image: {str(e)}")

def get_similarity(embedding1: np.ndarray, embedding2: np.ndarray) -> float:
    # Cosine Similarity: dot product of normalized vectors
    # ArcFace embeddings are usually normalized, but we'll be safe
    a = embedding1 / np.linalg.norm(embedding1)
    b = embedding2 / np.linalg.norm(embedding2)
    return float(np.dot(a, b))


from ultralytics import YOLO
yolo_model = YOLO("yolov8n.pt")

def yield_video_frames(video_path: str, camera_id: str, target_encoding: np.ndarray, alerts_list: list):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Cannot open video {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_index = 0
    COOLDOWN_SECONDS = 5
    last_alert_seconds = -10.0
    
    while True:
        ok, frame = cap.read()
        if not ok: break
        
        frame_index += 1
        # Skip frames for 2x performance effect
        if frame_index % 2 != 0:
            continue

        height, width = frame.shape[:2]
        # 480p is a good balance for YOLO + DeepFace
        if height > 480:
            scale = 480 / height
            frame = cv2.resize(frame, (int(width * scale), 480))

        # 1. Faster Person detection via YOLOv8
        results = yolo_model(frame, classes=[0], verbose=False)
        found_target = False
        current_best = 0.0

        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                # Expand crop slightly to give DeepFace context for alignment
                pad = 20
                crop = frame[max(0, y1-pad):min(y2+pad, frame.shape[0]), 
                             max(0, x1-pad):min(x2+pad, frame.shape[1])]
                
                if crop.size == 0: continue

                # 2. Advanced Feature Extraction inside the person crop
                color = (0, 0, 255) # Red: Unknown
                label = "Unknown"
                
                try:
                    # Use a faster detector (opencv or ssd) for the crop to maintain speed
                    # but keep ArcFace for matching accuracy
                    face_objs = DeepFace.represent(
                        img_path=crop,
                        model_name=RECOGNITION_MODEL,
                        detector_backend="opencv", # Fast for small crops
                        enforce_detection=False,
                        align=True
                    )
                    
                    for face in face_objs:
                        if face["face_confidence"] < 0.6: continue
                        
                        current_embedding = np.array(face["embedding"])
                        sim = get_similarity(target_encoding, current_embedding)
                        
                        # Threshold for ArcFace Cosine Similarity (higher is better match)
                        if sim > 0.45: # Adjusted threshold for "Balanced" mode
                            color = (0, 255, 0) # Green: Match
                            label = f"TARGET {sim:.1%}"
                            found_target = True
                            if sim > current_best:
                                current_best = sim
                except:
                    pass

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        if found_target:
            current_seconds = frame_index / fps
            if current_seconds - last_alert_seconds >= COOLDOWN_SECONDS:
                last_alert_seconds = current_seconds
                td = timedelta(seconds=int(current_seconds))
                
                if not any(a["timestamp"] == str(td) and a["camera"] == camera_id for a in alerts_list):
                    alerts_list.append({
                        "camera": camera_id,
                        "timestamp": str(td),
                        "score": round(current_best, 4)
                    })

        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret: continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
               
    cap.release()

