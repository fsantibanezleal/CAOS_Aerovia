// The measured gate on this build (caos-shell-gate, ADR-0078): serves dist/ as GitHub Pages does and walks every
// route, tab and case at five sizes, both themes and both languages, and requires Focus mode in the App. The expected brand is the product name from
// product.json, so the gate refuses to measure any other subject. Extra arguments are passed through, for example
//   npm run gate -- --sizes 1280x800 --themes light   (a quick pass while working)
//   npm run gate -- --url https://aerovia.fasl-work.com   (the deployed origin, after a deploy)
// GATE_OUT moves the report and the captures out of the tree (a temp folder on the data drive).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const product = JSON.parse(readFileSync(join(here, '..', '..', 'product.json'), 'utf8'));
const require = createRequire(import.meta.url);
const bin = join(dirname(require.resolve('@fasl-work/caos-app-shell/package.json')), 'bin', 'caos-shell-gate.mjs');
const extra = process.argv.slice(2);
const target = extra.includes('--url') ? [] : ['--serve', join(here, '..', 'dist')];
const out = ['--out', process.env.GATE_OUT || join(here, '..', 'gate-output')];
// --require-focus is always in effect (shell 0.14.0, ADR-0070): the App has a live engine and 3D scene, so it must carry
// Focus mode (G18), and no extra argument turns the requirement off.
const run = spawnSync(process.execPath, [bin, ...target, '--expect-brand', product.name, '--require-focus', ...out, ...extra], { stdio: 'inherit' });
process.exit(run.status ?? 1);
