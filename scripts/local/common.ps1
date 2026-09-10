Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:AeroviaRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))

function Invoke-AeroviaCommand {
    param([Parameter(Mandatory=$true)][string]$Program, [string[]]$Arguments = @())
    if (-not (Get-Command $Program -ErrorAction SilentlyContinue)) { throw "Required program is unavailable: $Program" }
    # Windows PowerShell treats native stderr as ErrorRecords. Exit codes remain authoritative.
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Program @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE." }
    } finally { $ErrorActionPreference = $previousPreference }
}

function Get-AeroviaPython {
    param([switch]$Gpu)
    $environmentName = if ($Gpu) { '.venv-gpu' } else { '.venv' }
    $pythonExecutable = Join-Path $script:AeroviaRoot "$environmentName/Scripts/python.exe"
    if (-not (Test-Path -LiteralPath $pythonExecutable)) {
        throw "Missing $environmentName. Run ./scripts/local/01_init.ps1$(if ($Gpu) { ' -Gpu' })."
    }
    return $pythonExecutable
}

function Assert-AeroviaNode {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 is required. Run ./scripts/local/00_install-prereqs.ps1.' }
    Invoke-AeroviaCommand node @('-e', "if(Number(process.versions.node.split('.')[0])!==24){console.error('Node.js 24 is required.');process.exit(1)}")
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is required; install Node.js 24 with npm.' }
}
