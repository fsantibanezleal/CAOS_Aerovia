// Aerovia's executive view (CAOS_MANAGE conventions/problem-context-first.md): an executive frame of the industry's problem,
// underground mine ventilation, general, never a client and never a pitch, valid against the shell's schema 2.0.0.
// The three illustrations are drawn by a separate unit; this test checks their paths and captions, not their drawing.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { EXECUTIVE_SCHEMA_VERSION, FOUR_CS, validateExecutive } from '@fasl-work/caos-app-shell';
import { describe, expect, it } from 'vitest';
import executive from '../../../content/executive.json';
import pkg from '../../package.json';

const NAMES = ['pain', 'situation', 'proposal'] as const;
const PUBLIC = new URL('../../public/', import.meta.url);

// The shell's own flip-card limits (gate/areas.mjs, the module the gate uses); the path is a variable so the type checker does not read the untyped module.
const AREAS = fileURLToPath(new URL('../../node_modules/@fasl-work/caos-app-shell/gate/areas.mjs', import.meta.url));
const { FLIP_LIMITS } = (await import(/* @vite-ignore */ pathToFileURL(AREAS).href)) as {
  FLIP_LIMITS: { title: Record<'en' | 'es', number>; back: Record<'en' | 'es', number> };
};

const words = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
type Bi = { en: string; es: string };
/** The labels the shell prints on the back of a card (ExecutiveView UI table), so a back is counted as the gate counts it. */
const LABELS = {
  cost: { en: 'Cost', es: 'Costo' },
  measure: { en: 'Measured by', es: 'Se mide por' },
  decides: { en: 'Decides', es: 'Decide' },
  needs: { en: 'Needs', es: 'Necesita' },
  achieves: { en: 'Achieves', es: 'Logra' },
  fallsShort: { en: 'Falls short', es: 'Se queda corto' },
} satisfies Record<string, Bi>;
/** The four flip groups: the title field and the fields (with their label) that make the back. A source mark adds one more token. */
const FLIP_GROUPS: Record<string, { rows: any[]; title: (r: any) => Bi; back: (r: any) => Array<[Bi | null, Bi]>; extra: number }> = {
  'pain.bearers': { rows: executive.pain.bearers, title: (r) => r.who, back: (r) => [[LABELS.cost, r.cost], [LABELS.measure, r.measure]], extra: 0 },
  'situation.roles': { rows: executive.situation.roles, title: (r) => r.role, back: (r) => [[LABELS.decides, r.decides], [LABELS.needs, r.needs]], extra: 0 },
  'situation.state_of_the_art': {
    rows: executive.situation.state_of_the_art,
    title: (r) => r.approach,
    back: (r) => [[LABELS.achieves, r.achieves], [LABELS.fallsShort, r.falls_short]],
    extra: 1,
  },
  'proposal.four_cs': { rows: executive.proposal.four_cs, title: (r) => r.c, back: (r) => [[null, r.applies]], extra: 0 },
};

/** The cards of the flip groups that break the shell's limits, one line each. */
function flipProblems(groups: typeof FLIP_GROUPS): string[] {
  const out: string[] = [];
  for (const lang of ['en', 'es'] as const) {
    for (const [path, g] of Object.entries(groups)) {
      for (const [i, row] of g.rows.entries()) {
        const title = words(g.title(row)[lang]);
        if (title > FLIP_LIMITS.title[lang]) out.push(`${path}[${i}] title ${lang}: ${title} words, the limit is ${FLIP_LIMITS.title[lang]}`);
        const back = g.back(row).reduce((n, [label, text]) => n + (label ? words(label[lang]) : 0) + words(text[lang]), 0) + g.extra;
        if (back > FLIP_LIMITS.back[lang]) out.push(`${path}[${i}] back ${lang}: ${back} words, the limit is ${FLIP_LIMITS.back[lang]}`);
      }
    }
  }
  return out;
}

const clone = () => JSON.parse(JSON.stringify(executive));

/** The floors of the standard (problem-context-first.md) as [min, max] counts of rows; the shell's schema holds the same numbers. */
const FLOORS: Record<string, [number, number]> = {
  headline_figures: [2, 3],
  'pain.paragraphs': [2, 3],
  'pain.bearers': [3, 5],
  'pain.figures': [2, 4],
  'pain.causes': [3, 5],
  'context.paragraphs': [1, 2],
  'context.forces': [3, 4],
  'context.evidence': [1, 4],
  'situation.roles': [3, 5],
  'situation.state_of_the_art': [3, 5],
  'trends.items': [3, 5],
  'proposal.paragraphs': [1, 2],
  'proposal.four_cs': [4, 4],
  'proposal.actions': [3, 6],
  'proposal.risks': [1, 4],
  'proposal.unknowns': [1, 4],
};

/** The source ids cited in each part of the file: 0 is the landing, 1 to 4 the sub-tabs that cite (the proposal cites none). */
function citations(): Array<{ source: string; tab: number }> {
  const out: Array<{ source: string; tab: number }> = [];
  const walk = (node: unknown, tab: number) => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, tab));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'source' && typeof v === 'string') out.push({ source: v, tab });
        else walk(v, tab);
      }
    }
  };
  walk(executive.headline_figures, 0);
  walk(executive.pain, 1);
  walk(executive.context, 2);
  walk(executive.situation, 3);
  walk(executive.trends, 4);
  return out;
}

/** Operation, mine and company names that the dossier's sources print; none may appear in the view (a source may name only its publisher in `sources`). */
const NAMED = /\b(Hongtoushan|Huanren|Kristineberg|Boliden|Zinkgruvan|Garpenberg|Aitik|El Teniente|Chuquicamata|Escondida|Codelco|BHP|Anglo American|Antofagasta|Epiroc|Sandvik|Metso|Howden|Newmont|Glencore|Vale|Rio Tinto|Barrick)\b/;

describe('the Aerovia executive view', () => {
  it('the shell is pinned exactly at 0.15.0 and the schema is 2.0.0', () => {
    expect(pkg.dependencies['@fasl-work/caos-app-shell']).toBe('0.15.0');
    expect(EXECUTIVE_SCHEMA_VERSION).toBe('2.0.0');
  });

  it('the executive data is valid against schema 2.0.0 and the writing limits, in both languages', () => {
    expect(validateExecutive(executive)).toEqual([]);
    expect(FOUR_CS).toHaveLength(4);
  });

  it('the 4 C\'s are Choice, Context, Cost and Control, in that order, named in both languages', () => {
    expect(executive.proposal.four_cs.map((r) => r.c.en)).toEqual(['Choice', 'Context', 'Cost', 'Control']);
    expect(executive.proposal.four_cs.map((r) => r.c.es)).toEqual(['Elección', 'Contexto', 'Costo', 'Control']);
  });

  it('the cause weights are whole percents that add to at most 100', () => {
    const total = executive.pain.causes.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeLessThanOrEqual(100);
    for (const c of executive.pain.causes) expect(Number.isInteger(c.weight)).toBe(true);
  });

  it('every action owner is a role of the current situation, written the same in both languages', () => {
    const roles = executive.situation.roles.map((r) => `${r.role.en}|${r.role.es}`);
    for (const a of executive.proposal.actions) expect(roles, a.owner.en).toContain(`${a.owner.en}|${a.owner.es}`);
  });

  it('the view meets every floor of the standard, in the sub-tabs and the landing', () => {
    const at = (path: string): unknown[] => path.split('.').reduce((node: any, key) => node[key], executive);
    for (const [path, [min, max]] of Object.entries(FLOORS)) {
      const n = at(path).length;
      expect(n, path).toBeGreaterThanOrEqual(min);
      expect(n, path).toBeLessThanOrEqual(max);
    }
    expect(executive.pain.figures.length + executive.context.evidence.length + executive.situation.state_of_the_art.length).toBeGreaterThanOrEqual(7);
  });

  it('every cited id is a source, every source is cited, each is a titled https link, and no sub-tab names more than six', () => {
    const ids = new Set(executive.sources.map((s) => s.id));
    expect(ids.size).toBe(executive.sources.length);
    const cited = new Set(citations().map((c) => c.source));
    for (const id of cited) expect(ids.has(id), `cited id ${id} is a source`).toBe(true);
    for (const s of executive.sources) {
      expect(s.id, s.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(s.url, s.id).toMatch(/^https:\/\/[^\s]+$/);
      expect(s.title.en.length, s.id).toBeGreaterThan(10);
      expect(s.title.es.length, s.id).toBeGreaterThan(10);
      expect(cited.has(s.id), `source ${s.id} is cited`).toBe(true);
    }
    for (const tab of [1, 2, 3, 4]) {
      const set = new Set(citations().filter((c) => c.tab === tab).map((c) => c.source));
      expect(set.size, `sub-tab ${tab}`).toBeLessThanOrEqual(6);
    }
  });

  it('every illustration path is an SVG under frontend/public and keeps the standard names', () => {
    for (const name of NAMES) {
      const file = executive.illustrations[name].file;
      expect(file, name).toBe(`executive/${name}.svg`);
      const url = new URL(file as string, PUBLIC);
      expect(url.href.startsWith(PUBLIC.href), `${name} stays under frontend/public`).toBe(true);
      expect(file as string, name).not.toMatch(/\.\./);
      // the drawing itself is another unit's; when it exists it is a file the shell can inline
      if (existsSync(url)) expect(url.pathname, name).toMatch(/\.svg$/);
    }
  });

  it('the view frames the problem space: no mine, company or vendor, no client, no product and no call to act', () => {
    const text = JSON.stringify({ ...executive, sources: undefined });
    expect(text).not.toMatch(NAMED);
    expect(text).not.toMatch(/\b(NHS|Inc\.|Ltd|GmbH)\b/);
    expect(text).not.toMatch(/\b(our client|nuestro cliente|workbench|banco de trabajo|this product|este producto|the app|la app|Aerovia)\b/i);
  });

  it('no exposure limit is compared to another number to number, and the 31.1 figure keeps its sector-share caveat', () => {
    const text = JSON.stringify(executive);
    // the elemental-carbon limit of the European Union and the total-carbon limit of the United States are different measures
    expect(text).not.toMatch(/160 (micro|µ)/i);
    const f1 = executive.headline_figures.find((f) => f.value.en === '31.1');
    expect(f1, 'the 31.1 headline figure').toBeDefined();
    expect(f1!.unit.en).toMatch(/at most 3 percent/);
    expect(f1!.unit.es).toMatch(/como máximo 3 por ciento/);
    expect(f1!.unit.en).toMatch(/2023/);
  });

  it('every figure keeps its year and the single-site figures say they are one site', () => {
    const f = (value: string) => [...executive.headline_figures, ...executive.pain.figures].find((x) => x.value.en === value)!;
    expect(f('1.3').unit.en).toMatch(/one limestone mine/);
    expect(f('1.3').unit.en).toMatch(/2019/);
    expect(f('122 of 1,246').unit.en).toMatch(/2000/);
    expect(f('up to 45').unit.en).toMatch(/2007/);
    expect(executive.situation.status.date.en).toMatch(/2018/);
    expect(executive.situation.status.unit.en).toMatch(/one (Swedish )?(underground )?(metal )?mine/);
  });

  it('every flip card of the four flip groups is small: a title and a back within the limits of the shell, in both languages', () => {
    expect(flipProblems(FLIP_GROUPS)).toEqual([]);
  });

  it('adversarial: a card over the limits, a broken rule or a planted name is refused', () => {
    const bearers = clone().pain.bearers;
    bearers[1].who.en = 'Underground workers who breathe diesel exhaust, blast fumes and heat every working shift';
    bearers[2].cost.es = Array.from({ length: 48 }, () => 'palabra').join(' ');
    const planted = { ...FLIP_GROUPS, 'pain.bearers': { ...FLIP_GROUPS['pain.bearers'], rows: bearers } };
    const found = flipProblems(planted).join(' | ');
    expect(found).toContain('pain.bearers[1] title en');
    expect(found).toContain('pain.bearers[2] back es');

    const long = clone();
    long.pain.key_message.en = Array.from({ length: 31 }, () => 'word').join(' ') + '.';
    expect(validateExecutive(long).map((p) => p.path)).toContain('pain.key_message.en');

    const uncited = clone();
    uncited.sources.push({ id: 'extra', title: { en: 'An extra source', es: 'Una fuente extra' }, url: 'https://example.org/x' });
    expect(validateExecutive(uncited).map((p) => p.message).join()).toMatch(/cited by no figure/);

    const owner = clone();
    owner.proposal.actions[0].owner.en = 'A role nobody has';
    expect(validateExecutive(owner).map((p) => p.path)).toContain('proposal.actions[0].owner');

    const weights = clone();
    weights.pain.causes.forEach((c: { weight: number }) => (c.weight = 60));
    expect(validateExecutive(weights).map((p) => p.path)).toContain('pain.causes');

    const fourcs = clone();
    fourcs.proposal.four_cs.reverse();
    expect(validateExecutive(fourcs).map((p) => p.path).join()).toMatch(/four_cs/);

    expect(NAMED.test(`a loader at ${'Hongtoushan'} mine`)).toBe(true);
  });
});
