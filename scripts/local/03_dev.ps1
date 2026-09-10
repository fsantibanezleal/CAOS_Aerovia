[CmdletBinding()]
param([ValidateRange(1024,65535)][int]$Port = 5908)
. "$PSScriptRoot/common.ps1"
Assert-AeroviaNode
if (-not (Test-Path -LiteralPath (Join-Path $script:AeroviaRoot 'frontend/node_modules'))) { & "$PSScriptRoot/01_init.ps1" }
Push-Location (Join-Path $script:AeroviaRoot 'frontend')
try { Invoke-AeroviaCommand npm @('run', 'dev', '--', '--host', '127.0.0.1', '--port', "$Port", '--strictPort') }
finally { Pop-Location }
