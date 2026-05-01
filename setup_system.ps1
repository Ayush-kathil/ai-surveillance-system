# Surveillance System - One-time Setup Script
# Installs host dependencies and pre-builds Docker images so normal startup is run-only.

$ErrorActionPreference = 'Stop'

$script:ComposeCommand = @()

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    if ($script:ComposeCommand.Count -eq 1) {
        & $script:ComposeCommand[0] @Args
    } else {
        & $script:ComposeCommand[0] $script:ComposeCommand[1] @Args
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Compose command failed: $($script:ComposeCommand -join ' ') $($Args -join ' ')"
    }
}

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$InstallHint
    )

    try {
        $null = Get-Command $Name -ErrorAction Stop
    } catch {
        throw "Required command '$Name' not found. $InstallHint"
    }
}

function Resolve-Compose {
    Assert-Command -Name "docker" -InstallHint "Install Docker Desktop and restart PowerShell."
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is installed but the engine is not running. Start Docker Desktop and retry."
    }

    try {
        docker compose version | Out-Null
        $script:ComposeCommand = @("docker", "compose")
        return
    } catch {
    }

    try {
        $null = Get-Command docker-compose -ErrorAction Stop
        docker-compose version | Out-Null
        $script:ComposeCommand = @("docker-compose")
        return
    } catch {
        throw "Neither 'docker compose' nor 'docker-compose' is available. Enable Compose in Docker Desktop."
    }
}

function Ensure-ModelFile {
    $modelTarget = Join-Path $PSScriptRoot "data\yolov8n.pt"
    if (Test-Path $modelTarget) {
        return
    }

    $modelSource = Join-Path $PSScriptRoot "backend\yolov8n.pt"
    if (Test-Path $modelSource) {
        Write-Host "Copying YOLO model to data volume path..." -ForegroundColor Cyan
        Copy-Item $modelSource $modelTarget -Force
    } else {
        Write-Host "YOLO model file not found at backend/yolov8n.pt or data/yolov8n.pt." -ForegroundColor Yellow
        Write-Host "Download yolov8n.pt into data/ before running detection." -ForegroundColor Yellow
    }
}

Push-Location $PSScriptRoot
try {
    Write-Host "--- 1. Verifying toolchain ---" -ForegroundColor Cyan
    Assert-Command -Name "python" -InstallHint "Install Python 3.11+ and add it to PATH."
    Assert-Command -Name "npm" -InstallHint "Install Node.js 20+ and add it to PATH."
    Resolve-Compose

    Write-Host "--- 2. Setting up Python environment ---" -ForegroundColor Cyan
    if (!(Test-Path ".venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor White
        python -m venv .venv
    }

    Write-Host "Installing backend dependencies into .venv..." -ForegroundColor White
    & ".venv\Scripts\python.exe" -m pip install --upgrade pip
    & ".venv\Scripts\python.exe" -m pip install -r backend/requirements.txt

    Write-Host "--- 3. Installing frontend dependencies ---" -ForegroundColor Cyan
    Push-Location frontend
    npm install
    Pop-Location

    Write-Host "--- 4. Preparing model assets ---" -ForegroundColor Cyan
    Ensure-ModelFile

    Write-Host "--- 5. Pre-building Docker images ---" -ForegroundColor Cyan
    Invoke-Compose -Args @("build")

    Write-Host "--- SETUP COMPLETE ---" -ForegroundColor Green
    Write-Host "Run-only startup command:" -ForegroundColor Green
    Write-Host "powershell -ExecutionPolicy Bypass -File .\run_full_project.ps1" -ForegroundColor White
} finally {
    Pop-Location
}
