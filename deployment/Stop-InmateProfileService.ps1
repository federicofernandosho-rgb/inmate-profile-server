param(
  [string]$ServiceName = "InmateProfile"
)

Stop-Service -Name $ServiceName
Get-Service -Name $ServiceName
