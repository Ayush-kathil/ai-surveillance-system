# Surveillance System - One Time Setup Script
# This installs all requirements and downloads AI models so that daily startup is FAST.

Write-Host "--- 1. Setting up Python Environment ---" -ForegroundColor Cyan
if (!(Test-Path ".venv")) {
    Write-Host "Creating Virtual Environment..."
    python -m venv .venv
}

Write-Host "Activating Virtual Environment and Installing Backend Requirements..."
& ".venv\Scripts\Activate.ps1"
pip install --upgrade pip
pip install -r backend/requirements.txt

Write-Host "--- 2. Pre-downloading AI Models (This makes the first run fast) ---"
python -c "from ultralytics import YOLO; YOLO('backend/yolov8n.pt'); from deepface import DeepFace; DeepFace.build_model('ArcFace')"

Write-Host "--- 3. Setting up Frontend Dependencies ---"
cd frontend
npm install
cd ..

Write-Host "--- SETUP COMPLETE ---" -ForegroundColor Green
Write-Host "You can now run '.\start_app.ps1' for a fast startup." -ForegroundColor Green
