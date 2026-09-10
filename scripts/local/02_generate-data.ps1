[CmdletBinding()]
param(
    [ValidateSet('cpu','cuda')][string]$Device = 'cpu',
    [ValidateRange(8,8192)][int]$Samples = 256,
    [uint32]$Seed = 20260909,
    [ValidateRange(0,0.75)][double]$Cv = 0.15,
    [switch]$Release
)
. "$PSScriptRoot/common.ps1"
$pythonExecutable = Get-AeroviaPython -Gpu:($Device -eq 'cuda')
Push-Location $script:AeroviaRoot
try {
    $caseFile = if ($Release) { 'build/local/release-cases.json' } else { 'build/local/cases.json' }
    $artifactDirectory = if ($Release) { 'data/artifacts' } else { 'build/local/artifacts' }
    # Always regenerate the complete deterministic case catalog; partial release bakes are not supported.
    Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'create', '--output', $caseFile)
    Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'validate', '--input', $caseFile)
    Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'bake', '--input', $caseFile, '--device', $Device, '--samples', "$Samples", '--seed', "$Seed", '--cv', $Cv.ToString([Globalization.CultureInfo]::InvariantCulture), '--output', $artifactDirectory)
    Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'verify', '--artifacts', $artifactDirectory, '--input', $caseFile)
    if ($Release) {
        Copy-Item -LiteralPath $caseFile -Destination 'data/cases.json' -Force
        Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'verify', '--artifacts', $artifactDirectory, '--input', 'data/cases.json')
    }
    Write-Host "Verified artifacts: $artifactDirectory. Next: ./scripts/local/06_verify.ps1"
} finally { Pop-Location }
