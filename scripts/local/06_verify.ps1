[CmdletBinding()]
param([switch]$Browser)
. "$PSScriptRoot/common.ps1"
$pythonExecutable = Get-AeroviaPython
Push-Location $script:AeroviaRoot
try {
    Invoke-AeroviaCommand $pythonExecutable @('scripts/check_public_safety.py', '--history')
    Invoke-AeroviaCommand $pythonExecutable @('scripts/check_content_standards.py')
    Invoke-AeroviaCommand $pythonExecutable @('scripts/check_template_residue.py')
    Invoke-AeroviaCommand $pythonExecutable @('-m', 'pytest', 'tests/python', '-q')
    Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'validate', '--input', 'data/cases.json')
    Invoke-AeroviaCommand $pythonExecutable @('scripts/pipeline.py', 'verify', '--artifacts', 'data/artifacts', '--input', 'data/cases.json')
    Invoke-AeroviaCommand $pythonExecutable @('scripts/surrogates.py', 'validate', '--models-output', 'data/models', '--science-output', 'data/artifacts/science.json')
    Push-Location frontend
    try {
        Invoke-AeroviaCommand npm @('run', 'typecheck')
        Invoke-AeroviaCommand npm @('test')
        Invoke-AeroviaCommand npm @('run', 'build')
        if ($Browser) { Invoke-AeroviaCommand npx @('playwright', 'install', 'chromium'); Invoke-AeroviaCommand npm @('run', 'test:e2e'); Invoke-AeroviaCommand node @('verify-learned-browser.mjs') }
    } finally { Pop-Location }
    Write-Host 'Verification passed. Next: ./scripts/local/04_preview.ps1 or review ./scripts/local/09_deploy.ps1.'
} finally { Pop-Location }
