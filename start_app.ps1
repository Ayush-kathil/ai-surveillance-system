param(
    [switch]$NoCache,
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

function Assert-Docker {
    $null = Get-Command docker -ErrorAction Stop
    docker-compose version | Out-Null
}

Write-Host "Verifying Docker tooling..." -ForegroundColor Cyan
Assert-Docker

Write-Host "Stopping existing surveillance containers..." -ForegroundColor Yellow
docker-compose down --remove-orphans

if (-not $NoBuild) {
    Write-Host "Building stack images..." -ForegroundColor Cyan
    if ($NoCache) {
        docker-compose build --no-cache
    } else {
        docker-compose build
    }
}

Write-Host "Starting stack in detached mode..." -ForegroundColor Green
docker-compose up -d

Write-Host "Waiting for backend health check (http://localhost:8001/health)..." -ForegroundColor Magenta
$retries = 45
$ready = $false
while ($retries -gt 0 -and -not $ready) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8001/health" -ErrorAction Stop
        if ($response.status -eq "Online") {
            $ready = $true
            Write-Host "Backend is ONLINE." -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
        $retries--
    }
}

if (-not $ready) {
    Write-Host "Backend health check timed out. Showing compose status:" -ForegroundColor Red
    docker-compose ps
    exit 1
}

Write-Host "Stack is ready." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend:  http://localhost:8001" -ForegroundColor White
Write-Host "Logs:     docker-compose logs -f" -ForegroundColor White
