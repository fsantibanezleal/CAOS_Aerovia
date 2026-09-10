# Aerovia

**Underground airflow engineering, with the mine and its calculations in one workbench.**

[Open the app](https://aerovia.fasl-work.com/) · [Documentation](docs/README.md) ·
[Run locally](docs/guides/01_local.md) · [Process your network](docs/guides/02_processing.md)

![The live three-level airflow workbench, with spatial network, fan controls and airway inspector](docs/assets/workbench.png)

Inspect a multi-level ventilation network, change an airway or fan setting, and see the resulting
redistribution of airflow, target shortfalls and electrical demand. Aerovia combines a browser-local
engineering tool with an independent Python reference solver and reproducible CUDA uncertainty
processing. No login, API key or upload is required.

## Capabilities

| Task | Implemented tools |
|---|---|
| Understand the mine | Interactive 3D and plan views, directional flow particles, level selection/separation, airway picking and a searchable network table |
| Locate a problem | Color by role, flow, velocity, pressure, target delivery or change from baseline; inspect signed values and convergence residuals |
| Test interventions | Change common fan speed, global/individual resistance, area and forward-flow targets; close airways and inspect connectivity/flow consequences |
| Assess energy | Fan operating point, 21-point speed sweep, annual energy/cost from entered hours and tariff |
| Find feasible settings | Bounded minimum common fan speed satisfying entered targets, with separate method restrictions, calculation failures and infeasibility outcomes |
| Prioritize investigation | One-at-a-time +5% resistance sensitivity, linked back to the spatial inspector |
| Retain and compare work | Saved baseline, flow/power differences, undo/redo, local recovery, validated project/network JSON and result CSV |
| Investigate uncertainty | Canonical flow/power intervals and target-attainment frequencies; local CPU or actual CUDA ensembles for another network |

The interface supports English/Spanish, light/dark themes, reduced motion, keyboard-accessible controls
and mobile panels. The network table and analytical tools remain available when WebGL cannot initialize.
Schematic geometry and separated levels aid inspection; presentation controls do not change the physics.

## A useful first workflow

1. Open **Three-level production** and inspect a working airway's flow and entered target.
2. **Save baseline**, then change fan speed or branch resistance. Target-delivery coloring identifies
   workings that lose or gain supply.
3. Open **Analysis** for the speed sweep, electrical comparison, minimum feasible speed and resistance
   sensitivity. Follow a ranked branch back to the inspector.
4. Export the project to retain its inputs, controls and baseline. Process that exported input locally
   when you need a matching uncertainty ensemble.

The [12 documented cases](docs/cases/README.md) cover production levels, deep workings, room-and-pillar
layouts, leakage, regulation, development headings, return restrictions, a booster and alternative
intakes. They are reproducible **authored engineering scenarios**, licensed Apache-2.0, with explicit
provenance. Imported engineering networks use the same [versioned contract](docs/data-contract/data-contract.md).

## Run locally

Use Node.js **24**, Python **3.13** for CPU work and Git. The separately tested CUDA environment uses
Python **3.12** and a compatible NVIDIA GPU/driver.

```powershell
# Windows PowerShell, from the repository root
./scripts/local/00_install-prereqs.ps1
./scripts/local/01_init.ps1
./scripts/local/03_dev.ps1
```

```bash
# Linux/macOS with the listed prerequisites installed
bash scripts/local/00_install-prereqs.sh
bash scripts/local/01_init.sh
bash scripts/local/03_dev.sh
```

Open `http://127.0.0.1:5908/`. Setup installs pinned project dependencies, preserves an existing ignored
`.env` and verifies committed artifact/input identities. No environment secrets are needed. The
[numbered command reference](scripts/local/README.md) covers preview, ports, verification and deployment.

## Reproduce the processing

The CLI creates cases, downloads checksum-pinned public HTTPS input, validates networks, solves
interventions, computes ensembles, exports CSV/JSON and verifies artifacts. The wrappers select isolated
interpreters:

```powershell
./scripts/local/02_generate-data.ps1 -Samples 256
./scripts/local/01_init.ps1 -Gpu
./scripts/local/05_gpu.ps1 -Samples 256
```

```bash
bash scripts/local/02_generate-data.sh --samples 256
bash scripts/local/01_init.sh --gpu
bash scripts/local/05_gpu.sh --samples 256
```

Normal runs write to ignored `build/local/`. Explicit `-Release` / `--release` prepares the complete
canonical catalog. Output is staged and verified before replacing an accepted artifact tree; failed
calculations preserve prior output. See [data processing](docs/guides/02_processing.md) and
[GPU processing](docs/guides/03_gpu.md) for imported inputs, seeds and uncertainty assumptions.

## Computation and hosting

![Independent local processing, verified publication and browser-local computation](docs/assets/architecture.svg)

Interactive solves and analysis run in a TypeScript Web Worker. Independent SciPy calculations provide
reference answers, while PyTorch CUDA evaluates resistance ensembles. The browser displays baked
uncertainty only when its original network and settings match; edits retain live deterministic tools
and require a new local bake for matching uncertainty.

GitHub Pages serves the static bundle at **aerovia.fasl-work.com**. No resident service or VPS is
required. Deployment verifies existing scientific artifacts and builds the frontend; it never creates
scientific results. Generated release metadata records `VERSION`, the checked-out Git commit, checkout
cleanliness and catalog SHA-256. A static asset manifest and `npm run verify:deployment` check the
published files' exact bytes and hashes against that release identity. Read
[architecture](docs/architecture.md) and [deployment](docs/guides/04_deployment.md).

## Numerical scope and evidence

The model is steady, constant-density and isothermal, with quadratic airway resistance and a monotone
fan curve. Inputs use SI units. Geometry and area do not silently determine resistance. Positive targets
are entered forward-flow design requirements.

Common-speed optimization is bounded to **0–1.5 times nominal speed** and requires equal prescribed
boundary pressures; it does not optimize independent fans or topology. Unsupported method assumptions
or a failed solve do not prove infeasibility. The equivalent system curve requires a single active fan,
equal boundary pressures and supported positive flow. Browser imports are limited to **2,000,000 bytes**;
the offline CLI accepts up to **5 MiB**. Both enforce **120 nodes and 240 edges per network**.

[Executed evidence](docs/methods/execution-evidence.md) records **3,072 CUDA resistance realizations**,
zero failed draws and 96 independent matched-draw SciPy checks. Maximum measured CUDA/SciPy branch-flow
difference was **1.181 × 10⁻¹¹ m³/s** for those cases. The manifest, inputs, versions and residuals support
reproduction; these are numerical measurements, not field calibration or universal performance claims.

Heat, contaminants, fires, compressibility, fan transients/stall physics, evacuation and equipment
control are outside this release. See the [physical model](docs/methods/ventilation-model.md) and
[uncertainty interpretation](docs/methods/uncertainty.md).

Run the complete local gate with `./scripts/local/06_verify.ps1 -Browser` or
`bash scripts/local/06_verify.sh --browser`: public source/history, numerical behavior, input/artifact
identity, frontend types/tests/build and Chromium user journeys.

## Repository map

| Path | Responsibility |
|---|---|
| `frontend/src/` | React workbench, Three.js scene, worker, numerical engine and project persistence |
| `data-pipeline/aerovia_pipeline/` | Case creation, independent solver, CPU/CUDA ensembles and verified IO |
| `data/cases.json`, `data/artifacts/` | Authored inputs, results, parity fixtures, CSV and manifest |
| `scripts/`, `tests/`, `frontend/e2e/` | Local/processing commands and numerical/browser checks |
| `docs/`, `deploy/`, `.github/workflows/` | Wiki, decisions, operating guides and verified publication |

Start with the [documentation index](docs/README.md). Contributions follow
[CONTRIBUTING.md](CONTRIBUTING.md); private vulnerability reporting follows [SECURITY.md](SECURITY.md).
Source and authored data are [Apache-2.0 licensed](LICENSE). External references and dependency assets
retain their own licenses. [Public-source and local-data boundaries](docs/security/security.md) explain
what is published and what remains on the visitor's device.
