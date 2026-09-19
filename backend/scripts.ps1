# EchoSeal backend — PowerShell helper scripts
# Equivalent to the Makefile targets, for Windows where `make` isn't available.
#
# Usage (run from the repo root — echo-seal/):
#   .\backend\scripts.ps1 build
#   .\backend\scripts.ps1 test-local
#   .\backend\scripts.ps1 test-local -RerecordPath "C:\path\to\recording.wav"

param(
    [Parameter(Mandatory=$true, Position=0)]
    [ValidateSet("build","test-local","test-rerecord","stop")]
    [string]$Target,

    [string]$RerecordPath = ""
)

$IMAGE     = "echoseal-lambda"
$REGION    = "ap-south-1"
$CONTAINER = "echoseal-local"

# Must run from the repo root (echo-seal/) so both backend/ and ml-audio/ are in context
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Build {
    Write-Host "`n── Building Docker image (linux/amd64) ──" -ForegroundColor Cyan
    Write-Host "Context: $RepoRoot" -ForegroundColor Gray
    Write-Host "First run downloads ~300 MB of model weights — please wait...`n" -ForegroundColor Yellow
    docker build --platform linux/amd64 -f backend/Dockerfile -t "${IMAGE}:latest" .
    if ($LASTEXITCODE -ne 0) { Write-Host "Build FAILED" -ForegroundColor Red; exit 1 }
    Write-Host "`n✓ Build succeeded." -ForegroundColor Green
}

function StartContainer {
    # Stop any existing container first
    docker stop $CONTAINER 2>$null | Out-Null
    Write-Host "`n── Starting container with ECHOSEAL_LOCAL=1 ──" -ForegroundColor Cyan
    docker run -d --rm --name $CONTAINER `
        -e ECHOSEAL_LOCAL=1 `
        -p 9000:8080 `
        "${IMAGE}:latest"
    if ($LASTEXITCODE -ne 0) { Write-Host "Failed to start container" -ForegroundColor Red; exit 1 }
    Write-Host "Waiting for Lambda RIE to be ready..." -ForegroundColor Gray
    Start-Sleep -Seconds 4
}

function StopContainer {
    Write-Host "`n── Stopping container ──" -ForegroundColor Cyan
    docker stop $CONTAINER 2>$null | Out-Null
}

function RunTests {
    param([string]$rerecord = "")
    Write-Host "`n── Running test suite ──" -ForegroundColor Cyan
    if ($rerecord -ne "") {
        $env:ECHOSEAL_RERECORD = $rerecord
        Write-Host "Re-recording test file: $rerecord" -ForegroundColor Yellow
    }
    python backend/tests/test_local.py
    $exitCode = $LASTEXITCODE
    if ($rerecord -ne "") { Remove-Item Env:ECHOSEAL_RERECORD -ErrorAction SilentlyContinue }
    return $exitCode
}

switch ($Target) {
    "build" {
        Build
    }
    "test-local" {
        Build
        StartContainer
        $code = RunTests
        StopContainer
        exit $code
    }
    "test-rerecord" {
        if ($RerecordPath -eq "") {
            Write-Host "Pass -RerecordPath <path to recording.wav>" -ForegroundColor Red
            exit 1
        }
        Build
        StartContainer
        $code = RunTests -rerecord $RerecordPath
        StopContainer
        exit $code
    }
    "stop" {
        StopContainer
    }
}
