from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import tempfile
from engine import load_encoding_from_image, process_video_feed

app = FastAPI(title="Surveillance Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/analyze")
async def analyze_surveillance(
    missing_image: UploadFile = File(...),
    cam1_video: UploadFile = File(...),
    cam2_video: UploadFile = File(...)
):
    try:
        # Load constraints
        img_bytes = await missing_image.read()
        try:
            target_encoding = load_encoding_from_image(img_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Save videos to tmp to process
        temp_dir = tempfile.mkdtemp()
        cam1_path = os.path.join(temp_dir, "cam1.mp4")
        cam2_path = os.path.join(temp_dir, "cam2.mp4")

        with open(cam1_path, "wb") as buffer:
            shutil.copyfileobj(cam1_video.file, buffer)
        with open(cam2_path, "wb") as buffer:
            shutil.copyfileobj(cam2_video.file, buffer)

        # Process Camera 1
        results1 = process_video_feed(cam1_path, "CAM-1", target_encoding)
        # Process Camera 2
        results2 = process_video_feed(cam2_path, "CAM-2", target_encoding)

        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

        # Aggregate Result
        all_detections = results1 + results2

        # Sort by timestamp roughly
        def time_to_sec(t_str):
            try:
                h, m, s = t_str.split(':')
                return int(h) * 3600 + int(m) * 60 + int(s)
            except:
                return 0

        all_detections.sort(key=lambda x: time_to_sec(x["timestamp"]))

        return {"status": "success", "detections": all_detections}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# Test health endpoint
@app.get("/health")
def read_root():
    return {"status": "Online"}
