[CmdletBinding()]
param(
    [ValidateSet('ingest','preprocess','dataset','features','train','infer','evaluate','diagnostics','export','validate','bake')]
    [string]$Stage = 'bake',
    [ValidateSet('cpu','cuda')][string]$Device = 'cuda',
    [switch]$Resume,
    [switch]$Release,
    [string]$Work = 'build/surrogates'
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    $pythonPath = Join-Path $repoRoot '.venv-gpu/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $pythonPath)) {
        throw 'Create the isolated Python 3.12 GPU environment using scripts/local/01_init.ps1 -Gpu, then install requirements-surrogates.txt.'
    }
    $arguments = @('scripts/surrogates.py', $Stage, '--work', $Work, '--device', $Device)
    if ($Resume) { $arguments += '--resume' }
    if ($Release) { $arguments += @('--models-output','data/models','--science-output','data/artifacts/science.json') }
    & $pythonPath @arguments
    if ($LASTEXITCODE -ne 0) { throw "Surrogate pipeline failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
