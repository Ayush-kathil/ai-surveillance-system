# FAST Execution Command for the Surveillance App
Write-Host "Cleaning up previous sessions..." -ForegroundColor Yellow
# Kill any process on port 8001 (Backend) or 3000 (Frontend)
try {
    $port8001 = Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue
    if ($port8001) { Stop-Process -Id $port8001.OwningProcess -Force }
    $port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($port3000) { Stop-Process -Id $port3000.OwningProcess -Force }
} catch { }

Write-Host "Starting Surveillance AI System..." -ForegroundColor Green

# 1. Start FastApi Backend
Write-Host "Initializing Backend Engine..." -ForegroundColor Cyan
if (Test-Path ".venv\Scripts\Activate.ps1") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; ..\.venv\Scripts\Activate.ps1; uvicorn app:app --port 8001" -WindowStyle Normal
} else {
    Write-Host "Warning: Virtual environment not found. Running with system python." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; uvicorn app:app --port 8001" -WindowStyle Normal
}

# 2. Waiting for Backend to be ready
Write-Host "Waiting for backend health check (http://localhost:8001/health)..." -ForegroundColor Magenta
$retries = 20
$ready = $false
while ($retries -gt 0 -and -not $ready) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8001/health" -ErrorAction Stop
        if ($response.status -eq "Online") {
            $ready = $true
            Write-Host "Backend is ONLINE!" -ForegroundColor Green
        }
    } catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $retries--
    }
}

# 3. Start Next.js Frontend
Write-Host "Initializing Next.js User Interface..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host "System is starting up!" -ForegroundColor Green
Write-Host "Interface will be ready at http://localhost:3000" -ForegroundColor White
