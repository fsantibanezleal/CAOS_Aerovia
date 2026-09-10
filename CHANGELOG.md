# Changelog

## v0.01.000: 2026-09-09

Initial release of the underground ventilation workbench and reproducible local processing system.
The public application requires no login, server-side calculation or visitor API key.

### Added

- Original English/Spanish workbench with light/dark themes, 3D/plan network inspection, animated
  signed airflow, level controls, quantitative coloring, coordinated selection and mobile panels.
- Strict network/project contracts, JSON import and structural editing, CSV export, local recovery,
  input-based baseline comparison and undo/redo. Imported baseline results are recomputed.
- Browser Web Worker for pressure-network solution, a 21-point speed sweep, bounded common-speed
  optimization and +5% airway-resistance sensitivity; target deficits, electrical demand and residuals.
- Twelve authored cases spanning production levels, room-and-pillar layouts, leakage, regulation,
  development headings, return restrictions, a booster and alternative intakes.
- Independent SciPy reference and real PyTorch CUDA resistance ensembles, CPU batch support, bounded
  batch allocation, explicit failure accounting and independent matched-draw comparisons.
- CLI to create, checksum-download, validate, solve, bake, export and verify. Transactional output
  promotion preserves prior results on failure and verifies source/option/file identities and physics.
- Canonical artifacts for 3,072 CUDA realizations, zero failed draws and 96 SciPy comparisons, with
  complete reproduction evidence, documented cases, contracts and method limits.
- Paired PowerShell/POSIX installation, CPU/GPU processing, development, preview, verification and
  deployment scripts using isolated environments and protected local output directories.
- Public-source/history audit, analytical/parity/import/transaction tests and Chromium journeys.
  GitHub Actions verifies existing artifacts and publishes the static frontend from main.
- Navigable documentation, a bilingual in-app architecture dialog, architecture decisions/diagram and
  custom-domain GitHub Pages guidance. Generated release metadata identifies version, source commit,
  checkout cleanliness and catalog checksum. An asset manifest and HTTPS verification command check
  exact deployed file sizes and hashes against the intended release revision.

### Scope

The model is steady, constant-density and isothermal. Authored cases have no field calibration; targets
are entered design assumptions. Common-speed optimization is bounded and does not optimize independent
fans or topology. Baked uncertainty belongs to its exact original inputs; edits require a new local
bake for matching uncertainty. Heat, contaminants/fire, fan transients and equipment control are outside
this release.
