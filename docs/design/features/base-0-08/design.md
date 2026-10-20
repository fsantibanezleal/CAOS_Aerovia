# Design: release 0.04.000 on the current base

Release 0.04.000 moves Aerovia from shell 0.6.8 with no template record (the live 0.03.000) to the shell and the product
template's guards of the current base: shell 0.15.0 pinned exactly during the units and the template's 0.08.002 guards, with
shell 0.16.0 and template 0.09.000 adopted at the release. It was sized first (components, boundaries, parallel units) and its
contract catalog written before the pages and the workbench that read it; the units were then built against the fixed catalog
rows. The sizing is kept with the coordination records outside the product.

- **Routes and the landing.** The product uses the shell's standard routes (`frontend/src/routes.ts`, `ROUTE_TABLE`): the
  landing at `/` and at every unknown path, the App at `/app`, and the five documentation routes. The header order is the
  shell's: App, Introduction, Methodology, Implementation, Experiments, Benchmark. Before this release the App was the root;
  an old App link (`/?case=...#...`) reaches the landing, which forwards it to `/app` with the query string and the hash kept.
  On Pages, `frontend/scripts/generate-manifest.mjs` writes the entry file of each route so a direct load answers 200.
- **The App on `CaseWorkbench`.** `frontend/src/workbench/Workbench.tsx` composes the shell's case workbench. The twelve
  authored networks and the reader's own design are the cases. The six modes of 0.03.000 became five question groups, Design,
  Airflow, Transport, Uncertainty and Learned models (the flow and operations modes merged into Airflow), and with the shell's
  Context view they are six peers (`frontend/src/workbench/groups.ts`; the shell counts the Context view among the peers, so six
  modes would have made seven). Each old tool page is a sub-view of exactly one group (`OLD_PAGES`, at most six sub-views per
  group). The rail has three sections, Setpoint, Values and Project; the operating controls are registered knobs, and
  `frontend/src/workbench/railState.ts` puts the speed, the resistance scale, every airway override and a design signature
  into the selection key, so nothing keeps a result for an earlier state. The 3D scene is drawn once and mounted in every
  sub-view; the tool pane floats over its left edge. The product's own focus toggle is replaced by the shell's Focus mode on the
  scene (ADR-0070): `?focus=1`, with the case, group and sub-view kept on entry and exit.
- **The executive view.** `content/executive.json` and three SVG illustrations under `frontend/public/executive/` (pain,
  situation, proposal; the pain scene is animated with a reduced-motion block). The Introduction has two views, the executive
  one first, rendered by the shell's `ExecutiveView`, and a technical view of five topics. The data is held by
  `frontend/src/content/executive.test.ts` and `illustrations.test.ts`, and by `scripts/check_sdd.py`.
- **The documentation areas.** The five pages sit on the shell's `DocPage` and `DocSection`, each section declaring an area
  of its page's vocabulary (`frontend/src/content/primitives.tsx`); Methodology has six method topics, each with a captioned
  figure; Implementation has eight topics in two groups and a captioned contract table in each contract section; Experiments
  and Benchmark meet their area floors; the citations are one file per page and the references are one block at the end of each
  open topic (`frontend/src/content/areas.test.ts`, `citations.test.ts`, `frontend/src/pages/*.test.ts`).
- **Contracts and readiness.** The catalog [`docs/contracts/catalog.md`](../../../contracts/catalog.md) has 17 rows with schemas,
  examples, a provider tree, producer and consumer tests and versions at 1.0.0; the pipeline writers validate before they write;
  the web types are generated from the schemas (`frontend/src/contracts.ts`); `data/readiness.json` records what is real in the
  build and the site labels what is not. The 38 tracked model files are declared in a row's `documents` cell, as the base's
  integrity guard requires.
- **Guards.** The template's guards come verbatim: version coherence, deploy place, SVG animation, web baseline, CI budget,
  doc paths, content standards, base integrity, and now `scripts/check_sdd.py` and `scripts/check_tech_matrix.py`. The planted
  defects that attack them are `tests/adversarial/`, written by a separate unit of the release.

The measured resources of the release are in [`../../measured-resources.md`](../../measured-resources.md).
