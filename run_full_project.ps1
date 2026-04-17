param(
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

Write-Host "Preparing workspace..." -ForegroundColor Cyan
& "$PSScriptRoot\scripts\cleanup_workspace.ps1" @PSBoundParameters

Write-Host "Starting full surveillance stack..." -ForegroundColor Cyan
& "$PSScriptRoot\start_app.ps1"