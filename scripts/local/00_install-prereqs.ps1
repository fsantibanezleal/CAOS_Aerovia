[CmdletBinding()]
param([switch]$Install, [switch]$Gpu)
. "$PSScriptRoot/common.ps1"
function Test-AeroviaBasePython {
    param([string]$Version)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        if (Get-Command py -ErrorAction SilentlyContinue) {
            $versionText = & py "-$Version" --version 2>$null
            if ($LASTEXITCODE -eq 0 -and "$versionText" -match "^Python $([regex]::Escape($Version))\.") { return $true }
        }
        if (Get-Command python -ErrorAction SilentlyContinue) {
            $versionText = & python --version 2>$null
            if ($LASTEXITCODE -eq 0 -and "$versionText" -match "^Python $([regex]::Escape($Version))\.") { return $true }
        }
        return $false
    } finally { $ErrorActionPreference = $previousPreference }
}
if ($Install) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'winget is unavailable. Install Node.js 24, Python 3.13 and Git from their official websites.' }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Invoke-AeroviaCommand winget @('install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--silent', '--accept-source-agreements', '--accept-package-agreements') }
    if (-not (Test-AeroviaBasePython '3.13')) { Invoke-AeroviaCommand winget @('install', '--id', 'Python.Python.3.13', '--exact', '--silent', '--accept-source-agreements', '--accept-package-agreements') }
    if ($Gpu -and -not (Test-AeroviaBasePython '3.12')) { Invoke-AeroviaCommand winget @('install', '--id', 'Python.Python.3.12', '--exact', '--silent', '--accept-source-agreements', '--accept-package-agreements') }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Invoke-AeroviaCommand winget @('install', '--id', 'Git.Git', '--exact', '--silent', '--accept-source-agreements', '--accept-package-agreements') }
}
Assert-AeroviaNode
if (Get-Command py -ErrorAction SilentlyContinue) { Invoke-AeroviaCommand py @('-3.13', '-c', "import sys; assert sys.version_info[:2] == (3, 13); print('Python', sys.version.split()[0])") }
elseif (Get-Command python -ErrorAction SilentlyContinue) { Invoke-AeroviaCommand python @('-c', "import sys; assert sys.version_info[:2] == (3, 13), 'Python 3.13 required'; print('Python', sys.version.split()[0])") }
else { throw 'Python 3.13 is required. Install it from python.org or rerun this script with -Install.' }
if ($Gpu -and -not (Test-AeroviaBasePython '3.12')) { throw 'The tested CUDA environment requires Python 3.12. Install it alongside Python 3.13, or run this script with -Install -Gpu.' }
Invoke-AeroviaCommand git @('--version')
Write-Host "Prerequisites available. Next: ./scripts/local/01_init.ps1$(if ($Gpu) { ' -Gpu' })"
