[CmdletBinding()]
param([ValidateRange(1024,65535)][int]$Port = 4908)
. "$PSScriptRoot/common.ps1"
Assert-AeroviaNode
Push-Location (Join-Path $script:AeroviaRoot 'frontend')
try {
    Invoke-AeroviaCommand npm @('run', 'build')
    Invoke-AeroviaCommand npm @('run', 'preview', '--', '--host', '127.0.0.1', '--port', "$Port", '--strictPort')
} finally { Pop-Location }
