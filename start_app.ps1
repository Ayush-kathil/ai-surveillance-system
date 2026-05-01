param(
    [switch]$Build,
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

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

function Assert-Docker {
    try {
        $null = Get-Command docker -ErrorAction Stop
    } catch {
        Write-Host "Docker CLI was not found on this machine." -ForegroundColor Red
        Write-Host "Install Docker Desktop for Windows and restart PowerShell." -ForegroundColor Yellow
        Write-Host "Download: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
        Write-Host "Then run: .\\start_app.ps1" -ForegroundColor White
        exit 1
    }

    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $dockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktopExe) {
            Write-Host "Docker engine is not running. Starting Docker Desktop..." -ForegroundColor Yellow
            Start-Process -FilePath $dockerDesktopExe | Out-Null

            $ready = $false
            for ($i = 0; $i -lt 60; $i++) {
                docker info | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $ready = $true
                    break
                }
                Start-Sleep -Seconds 2
            }

            if (-not $ready) {
                Write-Host "Docker Desktop did not become ready in time." -ForegroundColor Red
                Write-Host "Open Docker Desktop and wait for 'Engine running', then rerun: .\\start_app.ps1" -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host "Docker Desktop is installed but the Docker engine is not running." -ForegroundColor Red
            Write-Host "Start Docker Desktop and wait until it shows 'Engine running'." -ForegroundColor Yellow
            Write-Host "Then run: .\\start_app.ps1" -ForegroundColor White
            exit 1
        }
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
        Write-Host "Neither 'docker compose' nor 'docker-compose' is available." -ForegroundColor Red
        Write-Host "Enable Compose in Docker Desktop or reinstall Docker Desktop." -ForegroundColor Yellow
        Write-Host "Then run: .\\start_app.ps1" -ForegroundColor White
        exit 1
    }
}

Write-Host "Verifying Docker tooling..." -ForegroundColor Cyan
Assert-Docker

Write-Host "Stopping existing surveillance containers..." -ForegroundColor Yellow
Invoke-Compose -Args @("down", "--remove-orphans")

if ($Build) {
    Write-Host "Building stack images..." -ForegroundColor Cyan
    if ($NoCache) {
        Invoke-Compose -Args @("build", "--no-cache")
    } else {
        Invoke-Compose -Args @("build")
    }
}

Write-Host "Starting stack in detached mode..." -ForegroundColor Green
Invoke-Compose -Args @("up", "-d")

Write-Host "Waiting for backend health check (http://localhost:8001/health)..." -ForegroundColor Magenta
$retries = 120
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
    Invoke-Compose -Args @("ps")
    exit 1
}

Write-Host "Stack is ready." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend:  http://localhost:8001" -ForegroundColor White
if ($script:ComposeCommand[0] -eq "docker") {
    Write-Host "Logs:     docker compose logs -f" -ForegroundColor White
} else {
    Write-Host "Logs:     docker-compose logs -f" -ForegroundColor White
}
