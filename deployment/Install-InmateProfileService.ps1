param(
  [string]$ServiceName = "InmateProfile",
  [string]$AppDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Find-CommandPath {
  param(
    [string]$CommandName,
    [string[]]$FallbackPaths = @()
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  foreach ($fallback in $FallbackPaths) {
    if (Test-Path -LiteralPath $fallback) {
      return $fallback
    }
  }

  return $null
}

$NodePath = Find-CommandPath "node.exe" @(
  "C:\Program Files\nodejs\node.exe",
  "D:\Program Files\nodejs\node.exe"
)

$NssmPath = Find-CommandPath "nssm.exe" @(
  (Join-Path $AppDirectory "tools\nssm\nssm.exe"),
  (Join-Path $AppDirectory "tools\nssm\win64\nssm.exe"),
  (Join-Path $AppDirectory "tools\nssm\win32\nssm.exe")
)

if (-not $NodePath) {
  throw "Node.js was not found. Install Node.js 18+ on this server, then run this script again."
}

if (-not $NssmPath) {
  throw "nssm.exe was not found. Put nssm.exe in tools\nssm\nssm.exe or add NSSM to PATH, then run this script again."
}

# node_modules are pre-bundled — no npm install needed
$NodeModules = Join-Path $AppDirectory "node_modules"
if (-not (Test-Path -LiteralPath $NodeModules)) {
  throw "node_modules folder not found in $AppDirectory. Make sure you copied the full deployment package."
}

$LogsDirectory = Join-Path $AppDirectory "logs"
New-Item -ItemType Directory -Path $LogsDirectory -Force | Out-Null

$ServerPath = Join-Path $AppDirectory "server.js"
$ExistingService = & $NssmPath status $ServiceName 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Service '$ServiceName' already exists. Updating configuration..." -ForegroundColor Yellow
  & $NssmPath stop $ServiceName 2>$null | Out-Null
} else {
  & $NssmPath install $ServiceName $NodePath $ServerPath
}

& $NssmPath set $ServiceName AppDirectory $AppDirectory | Out-Null
& $NssmPath set $ServiceName AppParameters $ServerPath | Out-Null
& $NssmPath set $ServiceName AppStdout (Join-Path $LogsDirectory "service-output.log") | Out-Null
& $NssmPath set $ServiceName AppStderr (Join-Path $LogsDirectory "service-error.log") | Out-Null
& $NssmPath set $ServiceName AppRotateFiles 1 | Out-Null
& $NssmPath set $ServiceName AppRotateOnline 1 | Out-Null
& $NssmPath set $ServiceName AppRotateBytes 10485760 | Out-Null
& $NssmPath set $ServiceName Start SERVICE_AUTO_START | Out-Null
& $NssmPath set $ServiceName DisplayName "Inmate Profile" | Out-Null
& $NssmPath set $ServiceName Description "Inmate Profile Node.js web application" | Out-Null

Write-Host "Starting service '$ServiceName'..." -ForegroundColor Cyan
& $NssmPath start $ServiceName

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Open: http://pims:$Port"
Write-Host "Logs: $LogsDirectory"
