# Aerovia documentation

This wiki explains the spatial ventilation workbench, its independently verified processing, and the
steps needed to run the tools on another engineering network.

## Start with your task

| You want to… | Read |
|---|---|
| Use the workbench | [App](https://aerovia.fasl-work.com/) and [workflow overview](../README.md) |
| Run a clone | [Local installation](guides/01_local.md) and [numbered scripts](../scripts/local/README.md) |
| Process another network | [Processing guide](guides/02_processing.md), [data contract](data-contract/data-contract.md), [JSON Schema](data-contract/network.schema.json) |
| Reproduce CUDA results | [GPU guide](guides/03_gpu.md), [uncertainty](methods/uncertainty.md), [executed evidence](methods/execution-evidence.md) |
| Assess numerical validity | [Ventilation model](methods/ventilation-model.md) and [browser engine](engine/README.md) |
| Review release verification | [Acceptance and measured interaction](verification/release-acceptance.md) |
| Inspect a worked intervention | [Twelve documented cases](cases/README.md) |
| Maintain or extend the product | [Architecture](architecture.md) and [diagram](assets/architecture.svg) |
| Publish a release | [Deployment guide](guides/04_deployment.md) and [deployment summary](../deploy/README.md) |
| Review privacy/publication | [Local data boundaries](security/security.md), [audit](security/01_public_release_audit.md), [reporting policy](../SECURITY.md) |

## Architecture and software

- [System architecture](architecture.md): browser state, worker requests, independent processing,
  contracts, verified artifacts and publication.
- [ADR-001: Original workbench, superseded](architecture/ADR-001-original-workbench.md): task-led composition and
  retained bilingual, theme, accessibility and documentation requirements.
- [ADR-002: Computation and hosting](architecture/ADR-002-numerical-and-hosting-scope.md): live,
  offline and replay boundaries; the GitHub Pages decision.
- [Browser engine](engine/README.md): equations, continuation/Newton method, acceptance and analysis;
  [network contract](engine/network-contract.md) and [project/baseline contract](engine/project-contract.md).
- [Rendered UI review](engine/ui-review.md): exercised browser workflows, numerical interpretation
  corrections and observed behavior across the supported presentation states.

- [ADR-003: Shared spatial workspace](architecture/ADR-003-shared-spatial-workspace.md): direct authoring, conservative transport, actual learned screening and the rebuilt shared CAOS interface.

## Methods, data and evidence

- [Design and transport workflow](guides/05_spatial-and-transport.md): draw, connect, move, import, operate and reproduce.
- [Transport](methods/transport.md) and [routing](methods/routing.md): conservative cell histories, scheduled equilibrium changes, mass ledgers and directed paths.
- [Learned methods](methods/surrogates.md) and [model contracts](data-contract/learned-models.md): actual generation, splits, training, checkpoints, calibration, independent evaluation, ONNX export and browser inference.
- [Ventilation model](methods/ventilation-model.md): units, signs, constraints, algorithms, electrical
  power and target interpretation.
- [Resistance uncertainty](methods/uncertainty.md): distribution, seeds, chunking, quantiles, reference
  draws and failure accounting.
- [Executed evidence](methods/execution-evidence.md): actual device, versions, agreement, timings,
  checksums and exactly what the measurements establish.
- [Data contracts](data-contract/data-contract.md): structures, SI fields, closure semantics, manifests,
  transactional promotion and source matching.
- [Case library](cases/README.md): one page per authored network and intervention question. These are
  reproducible authored inputs, not operating-mine surveys.

The [guide index](guides/guides.md) links local execution, acquisition/import, CUDA processing and
deployment verification. Normal processing writes to ignored local directories; releases deliberately
promote a complete verified input/artifact set.

Source and authored data use [Apache-2.0](../LICENSE). Follow [contribution guidance](../CONTRIBUTING.md)
when changing a contract, equation or artifact. A successful solve establishes numerical closure for
the entered model; field applicability and survey calibration are separate questions.
