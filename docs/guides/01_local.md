# 01. Local installation and execution

## Runtime contract

Use Node.js **24** with npm and Python **3.13** for CPU work. The separately tested CUDA environment
uses Python **3.12**. CI selects Node 24.14.1 and Python 3.13; direct
frontend dependencies are locked in `frontend/package-lock.json`, and numerical dependencies are
pinned in `requirements.txt`. Git is needed to clone, check release artifacts and inspect public history.
The browser application requires neither Python nor a GPU after it has been built.

The baseline setup creates `.venv/`, installs the pinned CPU dependencies, runs `npm ci`, and copies
the comment-only `.env.example` to an ignored `.env` if needed. There are no application secrets or
required environment variables. Existing `.env` files are preserved. Dependencies are installed into
the project environments; setup does not upgrade the system Python installation.

## Windows PowerShell

From the cloned repository root:

```powershell
./scripts/local/00_install-prereqs.ps1
./scripts/local/01_init.ps1
./scripts/local/03_dev.ps1
```

If your PowerShell policy prevents trusted local scripts from running, invoke the particular script
with `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/local/01_init.ps1` after reviewing
it. This changes the policy for that process only. `00_install-prereqs.ps1 -Install` optionally installs
missing prerequisites using winget; checking is the default, and existing system executables are not
replaced. Reopen the terminal after a new system installation to refresh PATH.

## Linux and macOS

```bash
bash scripts/local/00_install-prereqs.sh
bash scripts/local/01_init.sh
bash scripts/local/03_dev.sh
```

The POSIX prerequisite script checks installed software and points to official downloads. It does not
guess your operating system package manager or invoke sudo. Install Python 3.13 with its `venv` support
and Node.js 24 before setup. On systems that separate `python3.13-venv`, install that package too.

## Development and production preview

Development serves at `http://127.0.0.1:5908/`. Preview builds the production bundle and serves at
`http://127.0.0.1:4908/`:

```powershell
./scripts/local/04_preview.ps1
```

```bash
bash scripts/local/04_preview.sh
```

Change a port with PowerShell `-Port 5910` or a POSIX positional port (`03_dev.sh 5910`). Servers bind
only to loopback and use strict ports: an occupied port produces a useful failure rather than opening
an unexpected address. Stop them with Ctrl+C. Direct commands are also available from `frontend/`:
`npm run dev`, `npm run build`, `npm run preview`.

The build copies the committed `data/artifacts/catalog.json` to `frontend/public/data/catalog.json`.
That public working copy and `frontend/dist/` are derived build outputs. Missing or incomplete canonical
data causes the build to fail; deployment cannot quietly replace the scientific results with a fresh bake.

## Verify a change

```powershell
./scripts/local/06_verify.ps1 -Browser
```

```bash
bash scripts/local/06_verify.sh --browser
```

The gate checks public-source patterns and reachable history, runs independent numerical tests,
validates the committed networks and artifact hashes, typechecks and tests the browser engine,
builds the app and optionally exercises real Chromium user journeys. Browser mode installs Chromium
through the project's pinned Playwright version. On minimal Linux systems install its OS prerequisites
with `npx playwright install --with-deps chromium` from `frontend/` using the system's normal privilege
policy. Omit the browser flag only for a targeted numerical/code check; a release requires browser checks.

## Recovery

| Failure | Action |
|---|---|
| Missing `.venv` | Run `01_init`; do not install project dependencies into system Python |
| Wrong Node major | Select Node 24, rerun `npm ci`; preserve the committed lockfile |
| Port already occupied | Select a different explicit port or stop the server you own |
| Missing canonical catalog | Restore committed data or perform an explicit full release bake; see guide 02 |
| Browser import rejected | Read the validation error and correct the input contract; avoid guessing units |
| Old browser data | Export the current network before clearing this site's local storage |

Official runtime references: [Node.js releases](https://nodejs.org/en/about/previous-releases),
[Python virtual environments](https://docs.python.org/3.13/library/venv.html),
[npm clean installation](https://docs.npmjs.com/cli/v11/commands/npm-ci),
[Playwright browser installation](https://playwright.dev/docs/browsers).
