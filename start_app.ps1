# Single Execution Command for the Surveillance App

Write-Host "Starting Surveillance AI System..." -ForegroundColor Green

# 1. Start FastApi Backend
Write-Host "Initializing Backend Engine..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; pip install -r requirements.txt; uvicorn app:app --reload --port 8001" -WindowStyle Normal

# 2. Start Next.js Frontend
Write-Host "Initializing Next.js User Interface..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm run dev" -WindowStyle Normal

Write-Host "Both Backend and Frontend are starting up!" -ForegroundColor Green
Write-Host "You can view the interface at http://localhost:3000" -ForegroundColor White
Write-Host "Stop the services by closing their pop-up windows manually." -ForegroundColor Yellow
