[CmdletBinding()]
param([switch]$ConfigurePages, [switch]$Dispatch)
. "$PSScriptRoot/common.ps1"
Push-Location $script:AeroviaRoot
try {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI is required. Install from https://cli.github.com/ and run gh auth login.' }
    Invoke-AeroviaCommand gh @('auth', 'status')
    $repository = (& gh repo view --json nameWithOwner,visibility | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine GitHub repository.' }
    if ($repository.visibility -ne 'PUBLIC') { throw 'Pages delivery requires this repository to be public. This script never changes repository visibility.' }
    $repoName = $repository.nameWithOwner
    if ((& git status --porcelain)) { throw 'Commit or isolate intended changes before deployment. The worktree must be clean.' }
    Invoke-AeroviaCommand git @('fetch', 'origin', '--prune')
    $localHead = & git rev-parse HEAD
    $remoteHead = & git rev-parse origin/main
    if ($LASTEXITCODE -ne 0 -or $localHead -ne $remoteHead) { throw 'Check out the verified origin/main revision before deploying.' }
    $domain = (Get-Content -LiteralPath 'frontend/public/CNAME' -Raw).Trim()
    if ($domain -notmatch '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$') { throw 'Invalid custom domain in frontend/public/CNAME.' }
    & "$PSScriptRoot/06_verify.ps1" -Browser
    if ($ConfigurePages) {
        $previousPreference = $ErrorActionPreference
        try { $ErrorActionPreference = 'Continue'; & gh api "repos/$repoName/pages" 2>$null | Out-Null; $pagesExists = ($LASTEXITCODE -eq 0) }
        finally { $ErrorActionPreference = $previousPreference }
        if (-not $pagesExists) { Invoke-AeroviaCommand gh @('api', '--method', 'POST', "repos/$repoName/pages", '-f', 'build_type=workflow') }
        Invoke-AeroviaCommand gh @('api', '--method', 'PUT', "repos/$repoName/pages", '-f', 'build_type=workflow', '-f', "cname=$domain")
    }
    if ($Dispatch) { Invoke-AeroviaCommand gh @('workflow', 'run', 'pages.yml', '--repo', $repoName, '--ref', 'main') }
    Invoke-AeroviaCommand gh @('api', "repos/$repoName/pages", '--jq', '{html_url,build_type,cname,https_enforced,status}')
    Invoke-AeroviaCommand gh @('run', 'list', '--repo', $repoName, '--workflow', 'pages.yml', '--branch', 'main', '--limit', '3')
    Write-Host "Preflight complete for $localHead. Domain: https://$domain. Use gh run watch <run-id> --repo $repoName --exit-status, then follow docs/guides/04_deployment.md for HTTPS and live checks."
} finally { Pop-Location }
