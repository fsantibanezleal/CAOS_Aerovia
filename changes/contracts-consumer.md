- The TypeScript types of every document and message are generated from the contract schemas
  (`frontend/src/lib/contract.gen.ts`, by `frontend/scripts/gen-contract-types.mjs` with openapi-typescript 7.13.0).
  `npm run build` runs the generator in `--check` mode first, so a schema change without a regeneration stops the build.
  The app's own type names (`contracts.ts`, `content/artifacts.ts`, `learned/types.ts`) are aliases of the generated
  types. The generator loads TypeScript 5.9.3 under the name `zz-typescript5`, because openapi-typescript needs the
  compiler API that the native TypeScript 7 of the type check does not have.
- Each view that reads a committed document shows what the readiness document says about it, as one line inside its
  existing container: the tool pane and the Context view of the App, the Experiments data table and the Benchmark page.
  An available view shows nothing. The text comes from `data/readiness.json`, which `frontend/scripts/copy-data.mjs`
  copies into the site at build, and which stops the build when it is absent. A catalog, registry or science document the
  readiness lists as missing is reported with its reason instead of a failed request, a model file it lists as absent is
  not offered, and a network it lists as absent is marked in the case selector.
- The consumer tests of the contracts: `frontend/src/lib/contract.test.ts` holds the committed documents and the provider
  tree to the schema files in both directions (the same assertions on both roots, an absent document is a failure naming
  its path), runs the solver worker, the transport simulation and the project export and checks what they write, and
  holds the hand types that remain to the generated ones at compile time; `frontend/src/readiness/readiness.test.ts`
  covers the six states, the missing document and the copy step.
