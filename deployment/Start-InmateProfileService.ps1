param(
  [string]$ServiceName = "InmateProfile"
)

Start-Service -Name $ServiceName
Get-Service -Name $ServiceName
