# The specification area

Where Aerovia states what it builds and proves the statement can fail. The area is `docs/design/` (the design),
`docs/contracts/` (the contracts as code) and `tests/` (the tests, with tests/adversarial for the planted defects). It
follows the form of the product template's specification area (release 0.08.002) and is checked by the template's guards
`scripts/check_sdd.py` and `scripts/check_tech_matrix.py`, taken verbatim. A guard fails when a part is missing or disagrees
with the repository.

Aerovia was built and released as 0.02.000 and 0.03.000 before this area existed, so the area was written for release
0.04.000 on the current base, from the code, the tests, the contract catalog, the sizing and the persisted research. Eight of
its features are retroactive and say so; the ninth, `base-0-08`, states what the release itself changes. The product's
earlier documentation (`docs/architecture.md`, `docs/engine/`, `docs/methods/`, `docs/data-contract/`, `docs/cases/`,
`docs/guides/`) is the longer account of the same system; the design area cites it and does not replace it.

## Aerovia's features

Each folder of [`features/`](features/) holds `requirements.md` and `validation.md`, and a `design.md`; `base-0-08` also holds
`tasks.md`. The first five are the App's question groups, in the order of the App.

| feature | what it holds | written |
|---|---|---|
| `design` | the Design group: the transactional editor, the mapped table import, the project file and the local workspace | retroactive |
| `airflow-and-fans` | the Airflow group: the exact steady solver, its input checks, fan duty, the common-speed optimiser, the sweep and the sensitivity | retroactive |
| `tracer-transport` | the Transport group: the conservative mixed-cell passive tracer and the directed routes | retroactive |
| `uncertainty` | the Uncertainty group: seeded resistance ensembles, their independent checks and the recorded evidence shown by the App | retroactive |
| `learned-screening` | the Learned models group: the topology MLP, the shared graph network, the domain checks, the ONNX exports and the registry | retroactive |
| `network-cases` | the twelve authored networks and the reader's own design as the cases of the workbench | retroactive |
| `offline-pipeline` | case creation, checksum-pinned acquisition, validated writes, manifests and transactional promotion | retroactive |
| `static-release` | the build, the release identity, the deployed-bytes check and the repository guards of a release | retroactive |
| `base-0-08` | release 0.04.000: the routes and the landing, the App on `CaseWorkbench` with Focus mode, the executive view, the documentation areas, the contract catalog and readiness | requirements before the units; this folder completed after them |

The feature list is derived from the App's five groups, the case library, the offline pipeline with its evidence, the static
release, and the release's own changes. Every requirement names a gate that exists today. The validation rows name the
planted-defect tests under tests/adversarial that the planted-defect unit of the release (U10a) writes; until that suite
lands, `scripts/check_sdd.py` reports exactly those rows as missing, and no requirement.

## The order

Research, then the executive brief, then sizing, contracts and the units.

1. **Research basis.** What was researched before the plan and what it decided: each claim with a source (a DOI or a
   URL), at least three distinct sources (one work cited as a DOI and as its URL counts once; example and localhost
   hosts count for none), and a line starting `UNVERIFIED:` for what stayed unverified (it may say none). Section
   `Research basis` of [`SDD.md`](SDD.md). Checked by `scripts/check_sdd.py`.
2. **Executive view.** The problem space in its real context, framed for a decision maker in executive language, before any
   development, general (never a client, never a pitch): one data file, `content/executive.json`, valid against the
   shell's `executive.schema.json` 2.0.0 (a title, a key statement and headline figures; five sub-tabs: the pain, the
   context, the current situation, the trends and the proposal with the 4 C's; three illustrations; a linked source for
   every figure and claim). Section `Executive brief` of [`SDD.md`](SDD.md), right after `Problem and non-goals`, names the
   file in a `Data file: content/executive.json` line and restates nothing. Checked by `scripts/check_sdd.py` (the file,
   its schema, its rules, its sources, its illustrations, the section) and `frontend/src/content/executive.test.ts`. The
   standard is the template's executive-brief guide.
3. **Sizing, summarised.** The product dimensioned before it is built: its components, its boundaries, the technology and
   version matrix and the resources of each stage. The sizing's coordination records (the parallel units, who owns them) live
   with the product's coordination, not here; this repository holds the product's own design facts. Sections
   `Sizing and contracts`, `Technology and versions` and `Resources` of [`SDD.md`](SDD.md), with the measurements in
   [`measured-resources.md`](measured-resources.md). Checked by `scripts/check_sdd.py` (the twelve sections are headings
   outside code fences, once, in order, each with a body; the resources table has one row for each of bake, tests, build and
   deploy and no empty or placeholder cell) and `scripts/check_tech_matrix.py` (the technology table is the pinned
   dependencies, version for version: every `requirements*.txt` and `frontend/package.json`; Python pins are exact `==`; a
   package.json range is allowed only when the lock records the same spec at its root and its locked version satisfies it,
   and the table holds the locked version).
4. **Contracts.** One row per boundary and per model slot in [`../contracts/catalog.md`](../contracts/catalog.md), one schema
   file each, an example, a test on each side, the missing-data behavior and a provider. A contract is mutable and
   versioned: its version follows its schema by semver, its history is a row per version whose kind is the semver step, and
   [`../contracts/versions.lock.json`](../contracts/versions.lock.json) holds the digest of each schema. Checked by
   `scripts/check_contracts.py`, `scripts/check_skeleton.py`, `scripts/check_readiness.py`, `scripts/check_documents.py` and
   `scripts/check_contract_versions.py` (CI runs it with `--base`, against the schemas at a git ref, so a hand-edited lock
   proves nothing).
5. **Requirements.** Per feature, `features/<feature>/requirements.md`: `| ID | statement | gate |`, every statement with
   SHALL, every gate a test or guard that exists and can fail: a `path::name` that names a live test in a test file (not in a
   string, a comment, another test's body or a skipped test), or a plain path that is a test file or a script. A row that is
   malformed, indented or split across lines is a finding, and so is a status other than live without an entry and a reason
   in `features/.status-allow`. Checked by `scripts/check_sdd.py`.
6. **Tests, red first.** Each requirement and edge case becomes a test that fails for the right reason before the code exists
   (`tests/`, `frontend/src/**/*.test.ts`, `frontend/e2e/`); the code that follows is the minimum that turns them green. The
   units of release 0.04.000 record their red and green runs in their reports.
7. **Adversarial validation.** Per feature, `features/<feature>/validation.md`: `| requirement | adversarial check | gate |`,
   one row per requirement, the check stated as what was planted or refuted and the gate the test that plants it: a test under
   tests/adversarial, or one named `test_adversarial_...` (Python) or `it('adversarial: ...')` (TypeScript). An ordinary
   test proves the requirement passes, not that it can fail. The adversarial name is a claim that a reviewer verifies against
   the planted defect, not proof: the guard checks the form, never what the test plants. A gate that skips for lack of a tool
   (a `skipif` mark, a `pytest.skip`, an `importorskip` of a package no requirements file pins) counts as not run: the row
   names a second gate that runs without the tool, or says `local-only: <why>` (five words or more) in its check cell, a
   reviewed exception for what needs node, a browser or the installed frontend. Checked by `scripts/check_sdd.py`.

## Where each part lives

| part | file | guard |
|---|---|---|
| research basis | `docs/design/SDD.md`, `Research basis` | `scripts/check_sdd.py` |
| executive view | `content/executive.json`, `docs/design/SDD.md`, `Executive brief` | `scripts/check_sdd.py`, the shell's gate |
| sizing summary, technology, resources | `docs/design/SDD.md`, `Sizing and contracts`, `Technology and versions`, `Resources` | `scripts/check_sdd.py`, `scripts/check_tech_matrix.py` |
| contracts, providers, states | `docs/contracts/catalog.md`, `docs/contracts/schemas/` | `scripts/check_contracts.py`, `scripts/check_skeleton.py`, `scripts/check_readiness.py` |
| contract versions and history | `docs/contracts/catalog.md` (`History`), `docs/contracts/versions.lock.json` | `scripts/check_contract_versions.py` |
| requirements | `docs/design/features/<feature>/requirements.md` | `scripts/check_sdd.py` |
| adversarial validation | `docs/design/features/<feature>/validation.md`, tests/adversarial | `scripts/check_sdd.py` |

## Changing a contract

Edit the schema, bump the version in the catalog by the semver rule (removed or renamed field, narrowed type or new required
field: major; new optional field: minor; description or example: patch), add the History row, then
`python scripts/check_contract_versions.py --update` and `python scripts/pipeline.py readiness`, and update both sides in the
same pull request. The check fails on a schema that changed under the same version (against the lock, and against the base ref
in CI), a version that went down, a lock that is not current, a History kind that is not the semver step, a breaking change
that is not a major bump, and a row without a History entry for its version. The breaking-change test is a mechanical floor
(a minimal JSON Schema diff, listed in the catalog); the reviewer still judges the semantic breaks it cannot see.

Running the design guards: `npm ci` in `frontend/` first (the executive check reads the shell's installed schema), then
`python scripts/check_tech_matrix.py` and `python scripts/check_sdd.py` from the repository root. They run on a workstation
today; adding them to `.github/workflows/ci.yml` is a step of the release unit, outside the unit that wrote this area.

## Known limits of the guards

Listed so nobody takes a pass for more than it is (from the template's own record of its guards).

- `check_contract_versions.py`: the mechanical floor does not see `contains`, `dependentRequired`, `propertyNames`,
  `if`/`then` or `unevaluatedProperties` added as new constraints. `--base ''` (an empty ref) is read as no base.
- `check_tech_matrix.py`: it has no `--base`; in `frontend/package-lock.json` it does not check that `resolved` names the
  locked version, and a git pin on a branch name passes as a pin (a SHA or a tag is better).
- `check_sdd.py`, the executive view: the shell's schema is read from `frontend/node_modules`, so the check needs `npm ci`
  first (it fails, and says so, without it, and with a schema that is not 2.0.0) and the `jsonschema` package. The rules a
  schema cannot say (the writing limits, the 4 C's, the owners, the weights, the sources by id, the wording) are held twice,
  in this script and in the shell's `validateExecutive` that `frontend/src/content/executive.test.ts` runs; the acronym rule,
  whether a figure says what its source says, and what an illustration draws are the shell's gate and a reviewer's judgement.
- `check_sdd.py`, the gates: a test name that stands for a family of cases (a vitest `it.each`) is not a gate the guard can
  read, so a requirement names the single `it` that sits beside it; the gate cell of such a requirement says so.
