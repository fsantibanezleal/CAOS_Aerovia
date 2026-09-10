#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
configure=false; dispatch=false
while (($#)); do
  case "$1" in
    --configure-pages) configure=true ;;
    --dispatch) dispatch=true ;;
    *) printf 'Usage: 09_deploy.sh [--configure-pages] [--dispatch]\n' >&2; exit 2 ;;
  esac
  shift
done
cd "$AEROVIA_ROOT"
command -v gh >/dev/null || { printf 'Install GitHub CLI from https://cli.github.com/ and run gh auth login.\n' >&2; exit 1; }
gh auth status
repository="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
[[ "$(gh repo view --json visibility --jq .visibility)" == PUBLIC ]] || { printf 'A public repository is required. This script never changes visibility.\n' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { printf 'Commit or isolate intended changes before deploying; worktree must be clean.\n' >&2; exit 1; }
git fetch origin --prune
local_head="$(git rev-parse HEAD)"
[[ "$local_head" == "$(git rev-parse origin/main)" ]] || { printf 'Check out the verified origin/main revision before deploying.\n' >&2; exit 1; }
domain="$(tr -d '\r\n' < frontend/public/CNAME)"
[[ "$domain" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || { printf 'Invalid custom domain in frontend/public/CNAME.\n' >&2; exit 1; }
bash scripts/local/06_verify.sh --browser
if $configure; then
  if ! gh api "repos/$repository/pages" >/dev/null 2>&1; then gh api --method POST "repos/$repository/pages" -f build_type=workflow; fi
  gh api --method PUT "repos/$repository/pages" -f build_type=workflow -f "cname=$domain"
fi
if $dispatch; then gh workflow run pages.yml --repo "$repository" --ref main; fi
gh api "repos/$repository/pages" --jq '{html_url,build_type,cname,https_enforced,status}'
gh run list --repo "$repository" --workflow pages.yml --branch main --limit 3
printf 'Preflight complete for %s. Domain: https://%s. Watch the workflow and follow docs/guides/04_deployment.md for HTTPS and live verification.\n' "$local_head" "$domain"
