// The types of every document and message Aerovia reads or writes. They are GENERATED: contract.gen.ts comes from the
// schema files of docs/contracts/schemas/ (ADR-0080 decision 2; `npm run contracts:types`, checked by `npm run build`).
// The names below are aliases of the generated types, never hand-written interfaces; contracts.ts and learned/types.ts
// re-export the ones the app has always named. contract.test.ts reads the committed documents, the provider tree, the
// examples and what the code writes against the schema files in both directions, and holds the hand types that remain
// (engine/transport.ts) to these at compile time.
//
// `conform` is the structural check the consumer tests run: a pure function over a parsed schema, so it can sit with the
// types without reading a file (the tests pass it the loader).
import type { components } from './contract.gen';

export type Schemas = components['schemas'];

/** Every reader-facing string is bilingual at the source. */
export type LocalizedText = Schemas['localized'];

// network library (data/cases.json), the project file and the worker requests carry one network
export type Network = Schemas['network'];
export type NetworkNode = Schemas['node'];
export type Fan = Schemas['fan'];
export type NetworkEdge = Schemas['edge'];
export type EdgeKind = NetworkEdge['kind'];
export type EdgeOverride = Schemas['edgeOverride'];
export type SolveOptions = Schemas['options'];
export type NetworkProvenance = Schemas['provenance'];

// the solver
export type Result = Schemas['result'];
export type OptimizationResult = Schemas['optimization'];
export type SensitivityPoint = Schemas['sensitivityPoint'];
export type CurvePoint = Schemas['curvePoint'];
export type EngineKind = Schemas['kind'];
export type EngineRequest = Schemas['request'];
/**
 * The worker's answer. The schema states the per-kind result with if/then, which a type generator cannot render (the
 * generated `result` is `unknown`); the union below is that statement, and contract.test.ts holds every kind's answer to
 * the schema itself.
 */
export type EngineResponse = Omit<Schemas['response'], 'result'> & {
  result?: Result | OptimizationResult | SensitivityPoint[] | CurvePoint[];
};

// the catalog (data/artifacts/catalog.json)
export type Catalog = Schemas['Catalog'];
export type CatalogCase = Catalog['cases'][number];
export type CatalogEnsemble = Schemas['ensemble'];
export type CatalogBenchmark = Catalog['benchmark'];
export type ReferenceChecks = Schemas['ReferenceChecks'];
export type ArtifactManifest = Schemas['ArtifactManifest'];

// the learned models
export type ModelRegistry = Schemas['ModelRegistry'];
export type ModelEntry = ModelRegistry['entries'][number];
export type ModelManifest = Schemas['ModelManifest'];
export type OnnxParity = Schemas['OnnxParity'];
export type BrowserEvidence = Schemas['BrowserEvidence'];
export type Science = Schemas['Science'];
export type Checkpoint = Schemas['Checkpoint'];
export type ModelIo = Schemas['ModelIo'];

// the run-time boundaries
export type ProjectFile = Schemas['ProjectFile'];
export type ReleaseIdentity = Schemas['ReleaseIdentity'];
export type TransportRequest = Schemas['workerRequest'];
export type TransportReplay = Schemas['replay'];

// readiness
export type Readiness = Schemas['Readiness'];
export type ReadinessEntry = Readiness['contracts'][number];
/** Every reader-facing string of the readiness document, bilingual. */
export type Text = Schemas['text'];

/** The declared state of a catalog row (docs/contracts/catalog.md, Missing-data states). */
export type ContractState = ReadinessEntry['state'];

/** What served a catalog row in this build; null when nothing did. */
export type Provenance = NonNullable<ReadinessEntry['provenance']>;

/** The schema identifiers the code reads, each tied by `satisfies` to the literal the generated type carries. */
export const SCHEMAS = {
  network: 'aerovia.network/v1',
  catalog: 'aerovia.catalog/v1',
  science: 'aerovia.science/v1',
  modelRegistry: 'aerovia.model-registry/v1',
  project: 'aerovia.project/v1',
  readiness: 'aerovia.readiness/v1',
  result: 'aerovia.result/v1',
  transport: 'aerovia.transport/v1',
} as const satisfies {
  network: Network['schema'];
  catalog: Catalog['schema'];
  science: Science['schema'];
  modelRegistry: ModelRegistry['schema'];
  project: ProjectFile['schema'];
  readiness: Readiness['schema'];
  result: Result['schema'];
  transport: Schemas['TransportResult']['schema'];
};

/** The part of JSON Schema 2020-12 the catalog's schema files use. */
export interface JsonSchema {
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  items?: JsonSchema | boolean;
  prefixItems?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: JsonSchema | boolean;
  propertyNames?: JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
}

/** Reads the schema file `file` (for example `network.schema.json`) for a reference into it. */
export type SchemaLoader = (file: string) => JsonSchema;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const kindOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' && Number.isInteger(v) ? 'integer' : typeof v);
const ARTICLE: Record<string, string> = { string: 'a string', number: 'a finite number', integer: 'an integer', boolean: 'a boolean', array: 'an array', object: 'an object', null: 'null' };

/** Whether `value` is of the JSON Schema `type`: an integer is a number, a boolean is neither, NaN and infinity are no number. */
function isType(value: unknown, type: string): boolean {
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return kindOf(value) === type;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function check(value: unknown, schema: JsonSchema | boolean, file: string, load: SchemaLoader, path: string, out: string[]): void {
  const at = path || '$';
  const child = (key: string) => `${at}.${key}`;
  if (schema === true) return;
  if (schema === false) {
    out.push(`${at}: no value is allowed here`);
    return;
  }
  if (schema.$ref !== undefined) {
    const [target, frag = ''] = schema.$ref.split('#');
    const owner = target === '' ? file : target;
    const root = load(owner);
    const name = frag.startsWith('/$defs/') ? frag.slice('/$defs/'.length) : null;
    const resolved = name === null ? (frag === '' ? root : undefined) : root.$defs?.[name];
    if (!resolved) throw new Error(`${at}: unresolved reference ${schema.$ref}`);
    check(value, resolved, owner, load, path, out);
    return;
  }
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some((t) => isType(value, t))) {
    out.push(`${at}: expected ${types.map((t) => ARTICLE[t] ?? t).join(' or ')}, got ${kindOf(value)}`);
    return;
  }
  if (schema.const !== undefined && !sameJson(value, schema.const)) out.push(`${at}: expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  if (schema.enum && !schema.enum.some((e) => sameJson(e, value))) out.push(`${at}: not one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) out.push(`${at}: below the minimum ${schema.minimum}, got ${value}`);
    if (schema.maximum !== undefined && value > schema.maximum) out.push(`${at}: above the maximum ${schema.maximum}, got ${value}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) out.push(`${at}: not above ${schema.exclusiveMinimum}, got ${value}`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) out.push(`${at}: not below ${schema.exclusiveMaximum}, got ${value}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) out.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) out.push(`${at}: longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) out.push(`${at}: does not match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(`${at}: more than ${schema.maxItems} items`);
    value.forEach((item, i) => {
      const positional = schema.prefixItems?.[i];
      if (positional !== undefined) check(item, positional, file, load, `${at}[${i}]`, out);
      else if (schema.items !== undefined) check(item, schema.items, file, load, `${at}[${i}]`, out);
    });
  }
  if (isObject(value)) {
    const props = schema.properties ?? {};
    for (const key of schema.required ?? []) if (!(key in value)) out.push(`${child(key)}: declared by the schema, not written`);
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) out.push(`${at}: fewer than ${schema.minProperties} properties`);
    for (const [key, v] of Object.entries(value)) {
      if (schema.propertyNames) {
        const names: string[] = [];
        check(key, schema.propertyNames, file, load, child(key), names);
        out.push(...names.map((n) => `${n} (a property name)`));
      }
      if (key in props) check(v, props[key], file, load, child(key), out);
      else if (isObject(schema.additionalProperties)) check(v, schema.additionalProperties, file, load, child(key), out);
      else if (schema.additionalProperties === false) out.push(`${child(key)}: written, not declared by the schema`);
    }
  }
  for (const part of schema.allOf ?? []) check(value, part, file, load, path, out);
  if (schema.oneOf) {
    const attempts = schema.oneOf.map((b) => {
      const sub: string[] = [];
      check(value, b, file, load, path, sub);
      return sub;
    });
    const matching = attempts.filter((a) => a.length === 0).length;
    if (matching === 0) out.push(`${at}: matches none of ${attempts.length} alternatives (${attempts.map((a) => a[0]).join(' | ')})`);
    else if (matching > 1) out.push(`${at}: matches more than one of ${attempts.length} alternatives`);
  }
  if (schema.anyOf) {
    const attempts = schema.anyOf.map((b) => {
      const sub: string[] = [];
      check(value, b, file, load, path, sub);
      return sub;
    });
    if (!attempts.some((a) => a.length === 0)) out.push(`${at}: matches none of ${attempts.length} alternatives (${attempts.map((a) => a[0]).join(' | ')})`);
  }
  if (schema.not) {
    const sub: string[] = [];
    check(value, schema.not, file, load, path, sub);
    if (sub.length === 0) out.push(`${at}: matches a shape the schema forbids`);
  }
  if (schema.if) {
    const cond: string[] = [];
    check(value, schema.if, file, load, path, cond);
    const branch = cond.length === 0 ? schema.then : schema.else;
    if (branch) check(value, branch, file, load, path, out);
  }
}

/**
 * Every way `value` departs from `schema` (the content of `file`), with its path; empty when it conforms. A key the
 * document carries that the schema does not name reads "written, not declared by the schema"; a required key the
 * document lacks reads "declared by the schema, not written". A boolean is not a number.
 */
export function conform(value: unknown, schema: JsonSchema, load: SchemaLoader, file: string): string[] {
  const out: string[] = [];
  check(value, schema, file, load, '', out);
  return out;
}
