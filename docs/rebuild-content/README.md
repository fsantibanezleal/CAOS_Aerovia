# Scientific companion and architecture

The Aerovia companion uses the shared CAOS shell and its `Equation`, `InlineMath`, `Cite`, `Refs`, `Callout` and `SubTabs` primitives. Its five routes are a scientific explanation and a working evidence reader. The instrument is the sixth route.

| Route          | Source modules                                                   | Scientific purpose                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introduction   | `frontend/src/content/introduction.ts`                           | Industrial decision, model scope, quantities, vocabulary and an end-to-end analysis sequence.                                                                             |
| Methodology    | `methods.ts`, `learned-methods.ts`                               | Four classical method families and two trained approximation families, with equations, numerical details, assumptions and primary references.                             |
| Implementation | `implementation.ts`                                              | Input validation, physical editing, browser and independent reference solvers, CUDA batches, training/export, transport and release verification.                         |
| Experiments    | `experiments.ts`, `cases.ts`                                     | Authored-data provenance, twelve engineering questions, six exact interventions, verification, partitions and robustness protocols.                                       |
| Benchmark      | `BenchmarkTools.tsx`, `MatrixHeatmap.tsx`, `pages/Benchmark.tsx` | Real browser calculations, same-input learned comparisons, a selectable error matrix, filtered target-status confusion, degradation, calibration coverage and provenance. |

`CaseContext.tsx` supplies the instrument's case companion. It explains the problem, components, formalization, scope, the six physical regimes, and how to interpret the visualization. It consumes the selected network without pretending that an imported project belongs to the authored benchmark.

## Research and transcription boundaries

The explanatory text was transcribed after primary-source review and comparison with the executable numerical implementation. The public reference registry is `frontend/src/content/citations.ts`. Original prose and diagrams explain the methods; no publisher figures or mine measurements are redistributed.

The mathematical implementation and reproducible protocols are documented in:

- [Ventilation equations](../methods/ventilation-model.md)
- [Passive transport](../methods/transport.md)
- [Airflow routes](../methods/routing.md)
- [Learned response models](../methods/surrogates.md)
- [Learned data contract](../data-contract/learned-models.md)
- [Spatial workspace](../methods/spatial-workspace.md)

The application distinguishes authored scenarios, numerical reference solutions, conditional uncertainty and learned approximation. Passive scalar transport does not resolve turbulent eddies, thermal buoyancy, fire chemistry or toxicology. Nominal airflow transit is not earliest tracer arrival or human evacuation. A learned model's successful execution does not imply exact pressure closure or field validation.

The benchmark reads `data/artifacts/catalog.json` and `data/artifacts/science.json`. It does not hard-code accuracy claims. The matrix uses actual method/case/regime test cells; selecting a cell filters the detailed rows and recomputes confusion counts from those selected rows. Raw and projected errors remain distinct. Very small reference errors use scientific notation, and absent metrics remain absent.

The degradation curve retains synthetic noisy inputs outside the live model domain. Calibration reports both its nominal target and observed held-out coverage, including undercoverage. The family-holdout section exposes its actual separate training budget and nominal calibration; it does not attribute every accuracy difference to topology or authorize arbitrary live graphs.

## Diagram contracts

`frontend/public/svg/tech/` contains five architecture diagrams: app, execution lanes, web flow, science, and data contracts. Every diagram is an authored vector asset using shell color variables. Translatable labels have paired `l-en` and `l-es` text at identical coordinates. Mathematical identifiers and source paths are neutral.

`ScienceDiagram.tsx` contains eight explanatory schematics. The fan chart computes its illustrative quadratic curves and their intersection from one consistent set of parameters. These figures are explicitly schematics, separate from computed case output. A full-size control provides contained horizontal inspection on small screens; it never scales the whole page beyond the viewport.

## Reproduce content review

Install the frontend dependencies and Playwright's Chromium browser using the repository's normal setup. Start the application at `http://127.0.0.1:5908`, or set `AEROVIA_QA_URL` to the stable preview URL, then run from the repository root:

```sh
node docs/rebuild-content/verify-svg.mjs
node docs/rebuild-content/verify-pages.mjs
node docs/rebuild-content/verify-benchmark.mjs
```

The scripts write screenshots and JSON receipts below ignored `build/local/` paths. They exercise actual browser controls and served artifacts. They do not modify scientific data or substitute expected predictions for runtime inference.

- SVG review checks twenty architecture combinations: five diagrams, two languages and two themes, including text bounds.
- Page review covers every companion tab and architecture tab at 1440 × 900 and 390 × 844, in both languages and themes. It checks viewport containment, KaTeX errors and authored scientific-diagram bounds, and captures full-size mobile figure inspection.
- Benchmark review executes both exported models on twelve actual held-out fixtures in both languages, verifies method/quantity selections and filtered confusion support, checks honest calibration and training-budget presentation, and fetches the public evidence downloads.

The application should be held stable during a review. A development-server hot reload can detach a control and invalidate that test attempt; final release validation should use the immutable production build. Content checks complement the repository's complete E2E suite and numerical/model verification. They do not establish deployment completion on their own.

Companion-page and diagram checks also do not establish the workbench's canvas-area or control-fit requirements. The workbench gate measures the actual canvas against the viewport and exercises each active task section, including focus mode and selected equipment. Long document tables and full-size diagrams may scroll inside their reading containers; active workbench controls must fit their task pane. The rejected layout and the current retest are recorded separately in [rebuild verification](../verification/rebuild-0.02.000.md).
