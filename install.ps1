# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# One-shot Windows installer that downloads the matching caracal binary from a GitHub Release.

[CmdletBinding()]
param(
    [string]$Version = $env:CARACAL_VERSION,
    [string]$InstallDir = $env:CARACAL_INSTALL_DIR
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repo = 'Garudex-Labs/caracal'
if ([string]::IsNullOrEmpty($Version)) { $Version = 'latest' }
if ([string]::IsNullOrEmpty($InstallDir)) {
    $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\caracal'
}

$arch = (Get-CimInstance Win32_OperatingSystem).OSArchitecture
switch -Wildcard ($arch) {
    '64-bit*' { $target = 'caracal-windows-x64.exe'; $tuiTarget = 'caracal-tui-windows-x64.exe' }
    'ARM 64*' { $target = 'caracal-windows-x64.exe'; $tuiTarget = 'caracal-tui-windows-x64.exe' }
    default   { throw "unsupported architecture: $arch" }
}

if ($Version -eq 'latest') {
    $base = "https://github.com/$repo/releases/latest/download"
} else {
    $base = "https://github.com/$repo/releases/download/$Version"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$dest = Join-Path $InstallDir 'caracal.exe'
$tuiDest = Join-Path $InstallDir 'caracal-tui.exe'

Write-Host "caracal-install: downloading $base/$target -> $dest"
Invoke-WebRequest -Uri "$base/$target" -OutFile $dest -UseBasicParsing

if ($env:CARACAL_SKIP_TUI -ne '1') {
    Write-Host "caracal-install: downloading $base/$tuiTarget -> $tuiDest"
    try {
        Invoke-WebRequest -Uri "$base/$tuiTarget" -OutFile $tuiDest -UseBasicParsing
    } catch {
        Write-Warning "caracal-install: optional caracal-tui binary not available for this release; skipping ($_)"
        if (Test-Path $tuiDest) { Remove-Item $tuiDest -Force }
    }
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not ($userPath -split ';' | Where-Object { $_ -ieq $InstallDir })) {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
    Write-Host "caracal-install: added $InstallDir to user PATH (open a new shell to pick it up)"
}

Write-Host 'caracal-install: installed. Next steps:'
Write-Host '  caracal up         # start stack (Docker Desktop required)'
Write-Host '  caracal init       # provision local zone'
Write-Host '  caracal run -- cmd # smoke test ambient tokens'
Write-Host '  caracal-tui        # interactive TUI to inspect zones, audit, agents'
