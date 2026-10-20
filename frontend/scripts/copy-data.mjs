// Prebuild: copy the readiness document into public/data/ so the site can say, per view, what is real in this build
// (ADR-0080 decision 4; docs/contracts/catalog.md, Missing-data states). prepare-data.mjs copies the catalog, the
// science document and the models; this step copies the one document it does not: data/readiness.json, computed by
// `python scripts/pipeline.py readiness`. An absent or unreadable document stops the build, as the catalog says (row
// readiness: "the site build stops"); the site itself still renders "readiness unknown" if it cannot fetch it.
// CAOS_DATA_ROOT selects another data tree (absolute, or relative to the repository root; the provider tree is
// docs/contracts/fixtures/data) and CAOS_DATA_OUT another output folder; the defaults are data/ and public/data/.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const absolute = (p) => (isAbsolute(p) ? p : resolve(repo, p));
const root = absolute(process.env.CAOS_DATA_ROOT?.trim() || 'data');
const out = process.env.CAOS_DATA_OUT?.trim() ? resolve(process.env.CAOS_DATA_OUT.trim()) : join(here, '..', 'public', 'data');
const source = join(root, 'readiness.json');

if (!existsSync(source)) {
  console.error(`[copy-data] readiness.json is missing under ${root}: run python scripts/pipeline.py readiness`);
  process.exit(1);
}
let doc;
try {
  doc = JSON.parse(readFileSync(source, 'utf8'));
} catch (e) {
  console.error(`[copy-data] ${source} is not valid JSON: ${e.message}`);
  process.exit(1);
}
if (doc?.schema !== 'aerovia.readiness/v1' || !Array.isArray(doc.contracts) || doc.contracts.length === 0) {
  console.error(`[copy-data] ${source} is not an aerovia.readiness/v1 document with a contracts list`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
copyFileSync(source, join(out, 'readiness.json'));
const states = {};
for (const c of doc.contracts) states[c.state] = (states[c.state] ?? 0) + 1;
console.log(`[copy-data] readiness.json: ${doc.contracts.length} rows (${Object.entries(states).map(([k, v]) => `${v} ${k}`).join(', ')}) -> ${join(out, 'readiness.json')}`);
