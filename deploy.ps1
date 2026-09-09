<#
.SYNOPSIS
  MyAbsence v2.0 - Windows Single-Enter Deployment Script
.DESCRIPTION
  Performs pre-flight verification, storage directory initialization,
  runs automated tests, and launches the server.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "[*] Initializing MyAbsence v2.0 Production Deployment (Windows)" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# 1. Storage Directories
Write-Host "[*] Preparing storage directories..." -ForegroundColor Gray
$dataDir = Join-Path $appDir "data"
if (-not (Test-Path $dataDir)) {
    $null = New-Item -ItemType Directory -Path $dataDir -Force
}

# 2. Pre-flight Tests
Write-Host "[*] Running automated pre-flight test suite..." -ForegroundColor Cyan
& node --test --test-concurrency=1 (Join-Path $appDir "tests\**\*.test.js")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Automated tests failed! Deployment aborted."
}
Write-Host "[OK] Pre-flight tests passed successfully." -ForegroundColor Green

# 3. Launch Server
Write-Host "[*] Launching MyAbsence Server..." -ForegroundColor Cyan
Write-Host "[OK] Local Access: http://localhost:3000" -ForegroundColor Green
& node (Join-Path $appDir "server.js")
