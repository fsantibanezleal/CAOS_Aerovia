// The readiness document on the web side (catalog: Missing-data states, ADR-0080 decisions 3 and 4). The pipeline
// declares, per catalog row, whether it is available, partial, stale, provided by a provider, training or missing;
// the views never decide that themselves, they read it here. Pure functions over the document, and one cached fetch.
import type { ContractState, Provenance, Readiness, ReadinessEntry, Text } from '../lib/contract.types';

export const READINESS_URL = 'data/readiness.json';

/** The most severe state first: the order in which a view's rows are reduced to one note. */
export const SEVERITY: ContractState[] = ['missing', 'partial', 'training', 'provider', 'stale', 'available'];

/**
 * The catalog rows each view reads, by the file it fetches: the workbench and the Experiments page read the catalog
 * (data/catalog.json, which carries the networks); the learned models read the registry and the ONNX files, with the
 * science document for their evidence; the Benchmark page reads those and links the browser evidence. The four
 * run-time rows (engine-worker, transport, project, release-identity) have no document, so no view reads their static
 * state: a worker that fails says so itself.
 */
export const VIEW_ROWS: Record<string, string[]> = {
  workbench: ['catalog'],
  models: ['catalog', 'model-registry', 'model-io', 'science'],
  experiments: ['catalog'],
  benchmark: ['catalog', 'science', 'model-registry', 'browser-evidence'],
};

/** What the frontend does with a state (the catalog's table "What each surface does"). */
export function behavior(state: ContractState): { showsResult: boolean; note: boolean } {
  return { showsResult: state !== 'missing', note: state !== 'available' };
}

export interface ViewRow {
  id: string;
  state: ContractState;
  provenance: Provenance | null;
  reason: Text | null;
}

/** The readiness of one view: `unknown` when the document is absent or names none of the view's rows. */
export type ViewState = { state: 'unknown' } | { state: ContractState; rows: ViewRow[] };

export const entryFor = (doc: Readiness | null, id: string): ReadinessEntry | undefined => doc?.contracts.find((c) => c.id === id);

/** The most severe state among the rows `ids` names, with each non-available row and its reason. */
export function viewState(doc: Readiness | null, ids: string[]): ViewState {
  const found = ids.map((id) => entryFor(doc, id)).filter((e): e is ReadinessEntry => !!e);
  if (!found.length) return { state: 'unknown' };
  const state = SEVERITY.find((s) => found.some((e) => e.state === s)) ?? 'available';
  const rows = found.filter((e) => e.state !== 'available').map((e) => ({ id: e.id, state: e.state, provenance: e.provenance, reason: e.reason }));
  return { state, rows };
}

/** The row `id` while it is missing: its document is not there, so a view says not available yet; null otherwise. */
export function rowUnavailable(doc: Readiness | null, id: string): ReadinessEntry | null {
  const row = entryFor(doc, id);
  return row?.state === 'missing' ? row : null;
}

/** The row that lists `path` (relative to data/models/) as an absent model file, or null. */
export function modelUnavailable(doc: Readiness | null, path: string): ReadinessEntry | null {
  if (!doc) return null;
  return doc.contracts.find((c) => (c.id === 'model-io' || c.id === 'checkpoint') && c.missing.includes(path)) ?? null;
}

/** True when the network row lists the network `id` as absent from the case library. */
export function networkAbsent(doc: Readiness | null, id: string): boolean {
  return entryFor(doc, 'network')?.missing.includes(id) ?? false;
}

/** The readiness document lists a row as missing: the view says not available yet, with the reason. */
export class ArtifactUnavailable extends Error {
  readonly row: string;
  readonly reason: Text;
  constructor(row: string, reason: Text | null) {
    const text = reason ?? { en: `${row} is not available yet.`, es: `${row} aún no está disponible.` };
    super(text.en);
    this.name = 'ArtifactUnavailable';
    this.row = row;
    this.reason = text;
  }
}

let cached: Promise<Readiness | null> | null = null;

/** Forgets the fetched document (a test starts clean; a page load never needs it). */
export function resetReadiness(): void {
  cached = null;
}

/**
 * The readiness document, fetched once per page load. A missing or unreadable document resolves to null (every view
 * then says readiness unknown) and names the cause on the console: it never breaks a view.
 */
export function loadReadiness(): Promise<Readiness | null> {
  cached ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}${READINESS_URL}`);
    if (!response.ok) throw new Error(`readiness.json: HTTP ${response.status}`);
    return (await response.json()) as Readiness;
  })().then(
    (doc) => {
      if (!doc || !Array.isArray(doc.contracts)) {
        console.error('[readiness] readiness.json: no contracts list; every view says readiness unknown');
        return null;
      }
      return doc;
    },
    (e: unknown) => {
      console.error(`[readiness] ${e instanceof Error ? e.message : String(e)}; every view says readiness unknown`);
      return null;
    },
  );
  return cached;
}

/** Throws ArtifactUnavailable when the readiness document says one of the rows `ids` is missing; an unreadable document never does. */
export async function requireAvailable(ids: string[]): Promise<void> {
  const doc = await loadReadiness();
  for (const id of ids) {
    const row = rowUnavailable(doc, id);
    if (row) throw new ArtifactUnavailable(row.id, row.reason);
  }
}
