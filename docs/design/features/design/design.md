# Design: drawing, importing and keeping a network

Written on 2026-10-20 from the code, after it (the Design group shipped in 0.02.000 and moved into the shell's case workbench
in this release). The longer account is [`docs/methods/spatial-workspace.md`](../../../methods/spatial-workspace.md) and
[`docs/methods/network-authoring.md`](../../../methods/network-authoring.md).

- **The group.** The Design group has five sub-views: Draw and move, Junction, Airway, Result and Display
  (`frontend/src/workbench/groups.ts`). The 3D scene is the instrument of every group; a visual crossing is not a junction
  until the reader splits (`docs/architecture.md`, section 2).
- **The editor.** `frontend/src/engine/editor.ts` applies every edit as one transaction on a copy and returns a new design:
  draw, connect, move, split, equipment and property edits. Identity and connectivity come from the editor only. A split
  creates a real intermediate junction and apportions the series resistance; a fan stays on one resulting airway. Display
  width, camera, level separation and the visible cut change presentation, never a physical input.
- **The importer.** `frontend/src/engine/tableImport.ts` reads a node table and an airway table with a visible column mapping
  and explicit unit conversion. Its limits are `TABLE_LIMITS` (2,000,000 UTF-8 bytes, 1000 rows, 64 columns) and the
  network limits of the solver (120 junctions, 240 airways). Papaparse reads the CSV. A failing table leaves the committed
  design and the source tables as they were.
- **The project and the workspace.** `frontend/src/storage.ts` writes and reads `aerovia.project/v1` (a 2 MiB limit, the
  `project` row of the catalog) and keeps the local workspace under the key `aerovia.project.v1`. A baseline is stored as
  inputs and recomputed on restore; a rejected import keeps the active design.
- **Contracts and tests.** The `project` row of [`../../../contracts/catalog.md`](../../../contracts/catalog.md); the tests
  named in `requirements.md`, and `tests/contracts/test_runtime.py` for the project example.
