param(
    [switch]$WhatIf,
    [switch]$SkipLegacyArchive,
    [switch]$PruneOutputs
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$archiveRoot = Join-Path $root '_archive'
$legacyRoot = Join-Path $archiveRoot 'legacy'

$cachePatterns = @(
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.next'
)

$legacyFolders = @(
    'temp_repo',
    'temp_face_repo'
)

function Remove-PathSafe {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (Test-Path -LiteralPath $Path) {
        if ($WhatIf) {
            Write-Host "[WhatIf] Remove $Path"
        } else {
            try {
                Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            } catch {
                $quotedPath = '"' + $Path + '"'
                $isDirectory = (Get-Item -LiteralPath $Path -Force).PSIsContainer

                if ($isDirectory) {
                    $deleteCommand = "takeown /f $quotedPath /r /d y >nul 2>nul & icacls $quotedPath /grant %USERNAME%:(OI)(CI)F /t /c >nul 2>nul & rmdir /s /q $quotedPath"
                } else {
                    $deleteCommand = "takeown /f $quotedPath >nul 2>nul & icacls $quotedPath /grant %USERNAME%:F /c >nul 2>nul & del /f /q $quotedPath"
                }

                if (-not (Invoke-CommandQuietly -CommandLine $deleteCommand)) {
                    throw
                }
            }
        }
    }
}

function Invoke-CommandQuietly {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandLine
    )

    if ($WhatIf) {
        Write-Host "[WhatIf] $CommandLine"
        return $true
    }

    $process = Start-Process -FilePath cmd.exe -ArgumentList '/c', $CommandLine -Wait -PassThru -WindowStyle Hidden
    return $process.ExitCode -eq 0
}

function Archive-LegacyFolder {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if (Test-Path -LiteralPath $Source) {
        if ($WhatIf) {
            Write-Host "[WhatIf] Archive $Source -> $Destination"
        } else {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
            if (Test-Path -LiteralPath $Destination) {
                Remove-Item -LiteralPath $Destination -Recurse -Force
            }

            $copyCommand = "robocopy `"$Source`" `"$Destination`" /E /NFL /NDL /NJH /NJS /R:1 /W:1 /XD .git"
            Invoke-CommandQuietly -CommandLine $copyCommand | Out-Null

            $deleteCommand = "takeown /f `"$Source`" /r /d y >nul 2>nul & icacls `"$Source`" /grant %USERNAME%:(OI)(CI)F /t /c >nul 2>nul & rmdir /s /q `"$Source`""
            $deleted = Invoke-CommandQuietly -CommandLine $deleteCommand
            if (-not $deleted -and (Test-Path -LiteralPath $Source)) {
                Write-Host "Warning: could not fully remove $Source"
            }
        }
    }
}

Write-Host "Scanning workspace: $root"
New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
New-Item -ItemType Directory -Force -Path $legacyRoot | Out-Null

foreach ($legacy in $legacyFolders) {
    if (-not $SkipLegacyArchive) {
        Archive-LegacyFolder -Source (Join-Path $root $legacy) -Destination (Join-Path $legacyRoot $legacy)
    }
}

$searchRoots = @(
    (Join-Path $root 'backend'),
    (Join-Path $root 'frontend')
) | Where-Object { Test-Path -LiteralPath $_ }

foreach ($searchRoot in $searchRoots) {
    foreach ($pattern in $cachePatterns) {
        Get-ChildItem -LiteralPath $searchRoot -Directory -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $pattern } |
            ForEach-Object { Remove-PathSafe -Path $_.FullName }
    }
}

$generatedFiles = @(
    (Join-Path $root 'backend\__pycache__'),
    (Join-Path $root 'frontend\.next'),
    (Join-Path $root 'output\snapshots'),
    (Join-Path $root 'output\logs')
)

foreach ($generated in $generatedFiles) {
    if ((Test-Path -LiteralPath $generated) -and $PruneOutputs) {
        Remove-PathSafe -Path $generated
    } elseif (Test-Path -LiteralPath $generated) {
        Write-Host "Kept generated output: $generated"
    }
}

Write-Host ""
Write-Host "Cleanup complete."
Write-Host "Active project: backend + frontend surveillance stack"
if ($SkipLegacyArchive) {
    Write-Host "Legacy archive step: skipped"
} else {
    Write-Host "Archived legacy folders: _archive\legacy\temp_repo and _archive\legacy\temp_face_repo"
}
if ($PruneOutputs) {
    Write-Host "Generated outputs were pruned: output\snapshots and output\logs"
} else {
    Write-Host "Generated outputs were preserved"
}
Write-Host "Removed caches: __pycache__, .next, .pytest_cache, .mypy_cache, .ruff_cache"