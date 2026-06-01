param(
  [string]$ServiceName = "InmateProfile",
  [string]$AppDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$NssmPath = (Get-Command "nssm.exe" -ErrorAction SilentlyContinue).Source
if (-not $NssmPath) {
  foreach ($path in @(
    (Join-Path $AppDirectory "tools\nssm\nssm.exe"),
    (Join-Path $AppDirectory "tools\nssm\win64\nssm.exe"),
    (Join-Path $AppDirectory "tools\nssm\win32\nssm.exe")
  )) {
    if (Test-Path -LiteralPath $path) {
      $NssmPath = $path
      break
    }
  }
}

if (-not $NssmPath) {
  throw "nssm.exe was not found. Add NSSM to PATH or put it under tools\nssm."
}

& $NssmPath stop $ServiceName 2>$null | Out-Null
& $NssmPath remove $ServiceName confirm

Write-Host "Service '$ServiceName' removed." -ForegroundColor Green
