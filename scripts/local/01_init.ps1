[CmdletBinding()]
param([switch]$Gpu)
. "$PSScriptRoot/common.ps1"
Push-Location $script:AeroviaRoot
try {
    Assert-AeroviaNode
    $environmentName = if ($Gpu) { '.venv-gpu' } else { '.venv' }
    $pythonVersion = if ($Gpu) { '3.12' } else { '3.13' }
    $versionTuple = if ($Gpu) { '(3,12)' } else { '(3,13)' }
    if (-not (Test-Path -LiteralPath "$environmentName/Scripts/python.exe")) {
        if (Get-Command py -ErrorAction SilentlyContinue) { Invoke-AeroviaCommand py @("-$pythonVersion", '-m', 'venv', $environmentName) }
        else { Invoke-AeroviaCommand python @('-c', "import sys; assert sys.version_info[:2] == $versionTuple, 'Python $pythonVersion required'"); Invoke-AeroviaCommand python @('-m', 'venv', $environmentName) }
    }
    $pythonExecutable = Get-AeroviaPython -Gpu:$Gpu
    Invoke-AeroviaCommand $pythonExecutable @('-c', "import sys; assert sys.version_info[:2] == $versionTuple, 'Recreate this environment with Python $pythonVersion'")
    Invoke-AeroviaCommand $pythonExecutable @('-m', 'pip', 'install', '-r', 'requirements.txt')
    if ($Gpu) { Invoke-AeroviaCommand $pythonExecutable @('-m', 'pip', 'install', '-r', 'requirements-gpu.txt') }
    if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
    Push-Location frontend
    try { Invoke-AeroviaCommand npm @('ci') } finally { Pop-Location }
    if (Test-Path -LiteralPath 'data/artifacts/manifest.json') { Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'verify', '--artifacts', 'data/artifacts', '--input', 'data/cases.json') }
    else { throw 'Canonical release artifacts are absent. Restore data/artifacts from the repository, or explicitly generate the full set with ./scripts/local/02_generate-data.ps1 -Release. Then rerun setup.' }
    Write-Host 'Setup complete. Next: ./scripts/local/03_dev.ps1'
} finally { Pop-Location }
