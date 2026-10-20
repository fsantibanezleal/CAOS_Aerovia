// The consumer side of the contract catalog (docs/contracts/catalog.md, ADR-0080): the committed documents against the
// schema files the TypeScript types are generated from, in both directions and with types. The same assertions run
// on two roots, the committed build (data/) and the provider tree (docs/contracts/fixtures/data/): the swap test of
// every row that has a committed document. The run-time rows (the two worker protocols, the project file, the release
// identity) have no committed document; their examples are held to their schema, and so is what the code writes:
// the solver worker, the transport simulation and the project export are run here and their output is checked.
// An absent root or document is a failure naming its path, never a pass.
//
// Aerovia has no HTTP API, so the template's api.contract.test.ts has no operation to hold: its counterpart is the
// section "the app's types are the generated types" below, which holds the hand types the code still carries
// (engine/transport.ts) to the types generated from the schemas, at compile time (tsc runs on this file).
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { CurvePoint, EngineRequest, EngineResponse, Network, OptimizationResult, Result, SensitivityPoint, SolveOptions } from '../contracts'
import { validateCatalog } from '../content/artifacts'
import { DEFAULT_OPTIONS, solveNetwork, validateNetwork, validateOptions } from '../engine'
import { simulateTransport, type FlowState, type TransportFrame, type TransportOptions, type TransportResult } from '../engine/transport'
import { dispatch } from '../engine/worker'
import { parseProject, serializeProject, type ProjectInputs } from '../storage'
import { conform, SCHEMAS, type JsonSchema, type ModelRegistry, type Schemas, type Science } from './contract.types'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..', '..', '..')
const schemaDir = join(repo, 'docs', 'contracts', 'schemas')
const catalogUrl = join(repo, 'docs', 'contracts', 'catalog.md')
const examplesDir = join(repo, 'docs', 'contracts', 'examples')

const roots: Record<string, URL> = {
  'data (the committed build)': pathToFileURL(join(repo, 'data') + '/'),
  'docs/contracts/fixtures/data (the provider)': pathToFileURL(join(repo, 'docs', 'contracts', 'fixtures', 'data') + '/'),
}
// A third root for the refutation: CONTRACT_TEST_ROOT=<a copy of the provider tree with a planted fault>.
if (process.env.CONTRACT_TEST_ROOT) roots[`CONTRACT_TEST_ROOT (${process.env.CONTRACT_TEST_ROOT})`] = pathToFileURL(resolve(process.env.CONTRACT_TEST_ROOT) + '/')

const schemaCache = new Map<string, JsonSchema>()
/** The schema file `file` (for example `network.schema.json`), read once. */
function loadSchema(file: string): JsonSchema {
  let schema = schemaCache.get(file)
  if (!schema) {
    const path = join(schemaDir, file)
    if (!existsSync(path)) throw new Error(`missing schema file: ${path}`)
    schema = JSON.parse(readFileSync(path, 'utf8')) as JsonSchema
    schemaCache.set(file, schema)
  }
  return schema
}
const against = (value: unknown, name: string): string[] => conform(value, loadSchema(`${name}.schema.json`), loadSchema, `${name}.schema.json`)

/** A committed document of `root`; an absent file is a failure that names its path. */
function readFrom(root: URL, rel: string): unknown {
  const url = new URL(rel, root)
  if (!existsSync(url)) throw new Error(`missing committed document: ${fileURLToPath(url)}`)
  return JSON.parse(readFileSync(url, 'utf8'))
}
const readExample = (name: string): unknown => {
  const path = join(examplesDir, name)
  if (!existsSync(path)) throw new Error(`missing provider example: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** The catalog rows (`## Contracts` table): the id, and the model io cell. */
function catalogRows(): { id: string; modelIo: string }[] {
  const rows: { id: string; modelIo: string }[] = []
  let inTable = false
  let ioColumn = -1
  for (const line of readFileSync(catalogUrl, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      inTable = line.trim() === '## Contracts'
      continue
    }
    if (!inTable || !line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells[0] === 'id') ioColumn = cells.findIndex((c) => c.toLowerCase() === 'model io')
    else if (!/^-+$/.test(cells[0])) rows.push({ id: cells[0], modelIo: ioColumn >= 0 ? cells[ioColumn] : '-' })
  }
  return rows
}

/** The rows with one committed JSON document: the catalog row, the path under the root and the schema file. */
const DOCUMENTS = [
  ['network', 'cases.json'],
  ['catalog', 'artifacts/catalog.json'],
  ['reference-checks', 'artifacts/reference-checks.json'],
  ['science', 'artifacts/science.json'],
  ['artifact-manifest', 'artifacts/manifest.json'],
  ['browser-evidence', 'models/browser-evidence.json'],
  ['model-manifest', 'models/manifest.json'],
  ['model-registry', 'models/registry.json'],
  ['onnx-parity', 'models/parity-fixtures.json'],
  ['readiness', 'readiness.json'],
] as const

for (const [label, root] of Object.entries(roots)) {
  describe(`CONTRACT: ${label} is exactly what the schemas declare`, () => {
    it.each(DOCUMENTS)('%s: %s conforms to its schema, extra and missing keys and types included', (row, rel) => {
      expect(against(readFrom(root, rel), row)).toEqual([])
    })

    it('the schema identifiers the code reads are the ones the documents carry', () => {
      const networks = readFrom(root, 'cases.json') as Network[]
      for (const n of networks) expect(n.schema).toBe(SCHEMAS.network)
      expect((readFrom(root, 'artifacts/catalog.json') as Schemas['Catalog']).schema).toBe(SCHEMAS.catalog)
      expect((readFrom(root, 'artifacts/science.json') as Science).schema).toBe(SCHEMAS.science)
      expect((readFrom(root, 'models/registry.json') as ModelRegistry).schema).toBe(SCHEMAS.modelRegistry)
      expect((readFrom(root, 'readiness.json') as Schemas['Readiness']).schema).toBe(SCHEMAS.readiness)
    })

    it('every network passes the browser validator, and the catalog carries the same networks with a converged answer', () => {
      const networks = readFrom(root, 'cases.json') as Network[]
      expect(networks.length).toBeGreaterThan(0)
      const ids = networks.map((n) => n.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const n of networks) {
        expect(() => validateNetwork(n), n.id).not.toThrow()
        const solved = solveNetwork(n, DEFAULT_OPTIONS)
        expect(solved.converged, n.id).toBe(true)
      }
      const catalog = readFrom(root, 'artifacts/catalog.json') as Schemas['Catalog']
      expect(catalog.cases.map((c) => c.network.id)).toEqual(ids)
      for (const row of catalog.cases) {
        expect(row.network).toEqual(networks.find((n) => n.id === row.network.id))
        expect(row.result.converged).toBe(true)
        expect(() => validateOptions(row.options, row.network)).not.toThrow()
      }
    })

    it('the reader of the catalog (content/artifacts.ts) accepts the document', () => {
      const catalog = readFrom(root, 'artifacts/catalog.json')
      const checked = validateCatalog(catalog)
      expect(checked.cases.length).toBe((catalog as Schemas['Catalog']).cases.length)
    })

    it('a solve of the browser solver conforms to the result definition of the catalog', () => {
      const networks = readFrom(root, 'cases.json') as Network[]
      for (const n of networks) {
        const solved = solveNetwork(n, DEFAULT_OPTIONS)
        const problems = conform(solved, loadSchema('catalog.schema.json').$defs!.result, loadSchema, 'catalog.schema.json')
        expect(problems, n.id).toEqual([])
      }
    })

    it('the registry names networks of the library and model files of the root, with the bytes it records', () => {
      const networks = new Set((readFrom(root, 'cases.json') as Network[]).map((n) => n.id))
      const registry = readFrom(root, 'models/registry.json') as ModelRegistry
      expect(registry.entries.length).toBeGreaterThan(0)
      for (const e of registry.entries) {
        expect(networks.has(e.networkId), `${e.methodId}/${e.networkId}`).toBe(true)
        const url = new URL(`models/${e.onnx.file}`, root)
        if (!existsSync(url)) throw new Error(`missing committed document: ${fileURLToPath(url)}`)
        expect(statSync(url).size, e.onnx.file).toBe(e.onnx.bytes)
        expect(e.signature.edgeIds.length, e.onnx.file).toBe(e.input.shape[1])
      }
    })

    it('the model manifest lists every ONNX file the registry names, with the same identity', () => {
      const manifest = readFrom(root, 'models/manifest.json') as Schemas['ModelManifest']
      const registry = readFrom(root, 'models/registry.json') as ModelRegistry
      for (const e of registry.entries) {
        const listed = manifest.files[e.onnx.file]
        expect(listed, e.onnx.file).toBeDefined()
        expect(listed.sha256, e.onnx.file).toBe(e.onnx.sha256)
        expect(listed.bytes, e.onnx.file).toBe(e.onnx.bytes)
      }
    })

    it('the readiness document lists every catalog row but itself, in order', () => {
      const readiness = readFrom(root, 'readiness.json') as Schemas['Readiness']
      const expected = catalogRows()
        .map((r) => r.id)
        .filter((id) => id !== 'readiness')
      expect(expected.length).toBe(16)
      expect(readiness.contracts.map((c) => c.id)).toEqual(expected)
    })
  })
}

describe('CONTRACT: an absent root or document is a failure that names its path', () => {
  it('reading a document of a root that does not exist throws with the path', () => {
    const gone = pathToFileURL(join(repo, 'docs', 'contracts', 'fixtures', 'no-such-root') + '/')
    expect(() => readFrom(gone, 'cases.json')).toThrow(/missing committed document: .*no-such-root.*cases\.json/)
  })
  it('a schema file that does not exist throws with the path', () => {
    expect(() => loadSchema('no-such.schema.json')).toThrow(/missing schema file: .*no-such\.schema\.json/)
  })
})

describe('CONTRACT: the run-time rows, held to their schemas', () => {
  const network = (readExample('engine-worker-request.json') as EngineRequest).network
  const request = (kind: EngineRequest['kind'], id: number | string = 7): EngineRequest => ({ id, kind, network, options: DEFAULT_OPTIONS })

  it('every example of the catalog validates against its schema', () => {
    const examples = readdirSync(examplesDir).filter((f) => f.endsWith('.json'))
    const byPrefix: [string, string][] = [
      ['engine-worker-', 'engine-worker'],
      ['transport-', 'transport'],
      ['project', 'project'],
      ['release-identity', 'release-identity'],
      ['branch-table-row', 'branch-table'],
      ['model-io', 'model-io'],
      ['checkpoint', 'checkpoint'],
    ]
    for (const file of examples) {
      const hit = byPrefix.find(([prefix]) => file.startsWith(prefix))
      expect(hit, `${file} belongs to a catalog row`).toBeDefined()
      expect(against(readExample(file), hit![1]), file).toEqual([])
    }
    expect(examples.length).toBeGreaterThanOrEqual(10)
  })

  it.each(['solve', 'optimize', 'sensitivity', 'curve'] as const)('the solver worker answers a %s request with a message the schema accepts', (kind) => {
    const req = request(kind)
    expect(against(req, 'engine-worker')).toEqual([])
    const response = dispatch(req)
    expect(response.id).toBe(req.id)
    expect(response.kind).toBe(kind)
    expect(response.error).toBeUndefined()
    expect(against(response, 'engine-worker')).toEqual([])
  })

  it('a worker that fails answers {id, kind, error}, which the schema accepts, never a result with it', () => {
    const bad = dispatch({ ...request('solve'), network: { ...network, edges: [] } })
    expect(typeof bad.error).toBe('string')
    expect(bad.result).toBeUndefined()
    expect(against(bad, 'engine-worker')).toEqual([])
    const both = { id: 1, kind: 'solve', error: 'x', result: solveNetwork(network, DEFAULT_OPTIONS) }
    expect(against(both, 'engine-worker').length).toBeGreaterThan(0)
    expect(against({ id: 1, kind: 'solve' }, 'engine-worker').length).toBeGreaterThan(0)
    expect(against({ id: 1, kind: 'solve', result: { ...solveNetwork(network, DEFAULT_OPTIONS), flows: 'no' } }, 'engine-worker').length).toBeGreaterThan(0)
  })

  it('the transport simulation answers {result} in the shape of the schema, and a bad request answers {error}', () => {
    const example = readExample('transport-request.json') as { network: Network; options: SolveOptions; request: TransportOptions }
    expect(against(example, 'transport')).toEqual([])
    const result = simulateTransport(example.network, example.options, example.request)
    // the worker posts {result}; structured clone keeps plain data, which JSON stands for here
    const message = JSON.parse(JSON.stringify({ result }))
    expect(against(message, 'transport')).toEqual([])
    expect(result.completed).toBe(true)
    expect(against({ error: 'Transport failed.' }, 'transport')).toEqual([])
    expect(against({ error: '' }, 'transport').length).toBeGreaterThan(0)
    expect(against({ result: { ...message.result, steps: 1.5 } }, 'transport').length).toBeGreaterThan(0)
    expect(() => simulateTransport(example.network, example.options, { durationSeconds: -1, releases: [] })).toThrow()
  })

  it('the replay download is the schema: version, network, options, request and result', () => {
    const replay = readExample('transport-replay.json') as { request: TransportOptions; network: Network; options: SolveOptions }
    expect(against(replay, 'transport')).toEqual([])
    expect(against({ ...replay, extra: 1 }, 'transport').length).toBeGreaterThan(0)
  })

  it('the project export is the schema, for every network of both roots, and an import round-trips', () => {
    for (const [label, root] of Object.entries(roots)) {
      for (const n of readFrom(root, 'cases.json') as Network[]) {
        const input: ProjectInputs = {
          schema: 'aerovia.project/v1',
          network: n,
          options: { speed: 0.9, resistanceScale: 1.2, overrides: { [n.edges[0].id]: { closed: true } } },
          baseline: { network: n, options: DEFAULT_OPTIONS },
          savedAt: '2026-10-20T00:00:00.000Z',
        }
        const text = serializeProject(input)
        const written = JSON.parse(text)
        expect(against(written, 'project'), `${label}: ${n.id}`).toEqual([])
        expect(parseProject(text).network).toEqual(n)
      }
    }
  })

  it('the project example is read by the app, and the app drops a field the schema does not declare', () => {
    const example = readExample('project.json') as ProjectInputs
    expect(against(example, 'project')).toEqual([])
    const project = parseProject(JSON.stringify(example))
    expect(project.schema).toBe(SCHEMAS.project)
    const written = JSON.parse(serializeProject({ ...example, extra: 'x' } as unknown as ProjectInputs))
    expect(written.extra).toBeUndefined()
    expect(against({ ...example, extra: 'x' }, 'project').length).toBeGreaterThan(0)
  })

  it('the release identity example has the five keys the build writes and nothing else', () => {
    const identity = readExample('release-identity.json') as Record<string, unknown>
    expect(Object.keys(identity).sort()).toEqual(['catalogSha256', 'commit', 'scienceSha256', 'version', 'workingTreeDirty'])
    expect(against(identity, 'release-identity')).toEqual([])
    expect(against({ ...identity, extra: 1 }, 'release-identity').length).toBeGreaterThan(0)
  })
})

describe('CONTRACT: the model slots', () => {
  it('the model slots of the catalog are the two rows with a model io cell', () => {
    expect(catalogRows().filter((r) => r.modelIo !== '-').map((r) => r.id)).toEqual(['model-io', 'checkpoint'])
  })
  it('the 17 catalog rows each have a schema file whose $id is its file name', () => {
    const rows = catalogRows()
    expect(rows.length).toBe(17)
    for (const { id } of rows) {
      const schema = loadSchema(`${id}.schema.json`)
      expect(schema.$id, id).toBe(`${id}.schema.json`)
    }
    expect(readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json')).length).toBe(17)
  })
})

describe('CONTRACT: the checker', () => {
  const schema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['n', 'kind', 'list'],
    properties: {
      n: { type: 'number', minimum: 0 },
      kind: { enum: ['a', 'b'] },
      fixed: { const: 'v1' },
      list: { type: 'array', items: { type: 'integer' } },
      nested: { type: 'object', additionalProperties: false, required: ['deep'], properties: { deep: { type: 'string', pattern: '^x' } } },
    },
  }
  const run = (v: unknown) => conform(v, schema, loadSchema, 'inline.json')
  it('accepts a document that conforms', () => {
    expect(run({ n: 1, kind: 'a', list: [1, 2], nested: { deep: 'xy' } })).toEqual([])
  })
  it('adversarial: a boolean is not a number, an extra and a missing key are named, a wrong enum, const and depth are caught', () => {
    expect(run({ n: true, kind: 'a', list: [] }).join('\n')).toMatch(/\$\.n: expected a finite number/)
    expect(run({ n: 1, kind: 'a', list: [], surprise: 1 }).join('\n')).toMatch(/surprise: written, not declared by the schema/)
    expect(run({ n: 1, list: [] }).join('\n')).toMatch(/kind: declared by the schema, not written/)
    expect(run({ n: 1, kind: 'c', list: [] }).join('\n')).toMatch(/kind: not one of/)
    expect(run({ n: 1, kind: 'a', list: [], fixed: 'v2' }).join('\n')).toMatch(/fixed: expected "v1"/)
    expect(run({ n: 1, kind: 'a', list: [1, 1.5] }).join('\n')).toMatch(/list\[1\]: expected an integer/)
    expect(run({ n: -1, kind: 'a', list: [] }).join('\n')).toMatch(/n: below the minimum 0/)
    expect(run({ n: 1, kind: 'a', list: [], nested: { deep: 'y', more: 1 } }).join('\n')).toMatch(/nested\.deep: does not match/)
    expect(run({ n: 1, kind: 'a', list: [], nested: { deep: 'y', more: 1 } }).join('\n')).toMatch(/nested\.more: written, not declared/)
    expect(run({ n: NaN, kind: 'a', list: [] }).join('\n')).toMatch(/expected a finite number/)
  })
  it('oneOf, anyOf, allOf, if/then/else and not behave as JSON Schema does', () => {
    const one: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'number' }] }
    expect(conform('x', one, loadSchema, 'i')).toEqual([])
    expect(conform(true, one, loadSchema, 'i').length).toBeGreaterThan(0)
    const both: JsonSchema = { oneOf: [{ type: 'number' }, { type: 'integer' }] }
    expect(conform(1, both, loadSchema, 'i').join('')).toMatch(/matches more than one/)
    const cond: JsonSchema = { if: { required: ['a'] }, then: { required: ['b'] }, else: { not: { required: ['b'] } } }
    expect(conform({ a: 1, b: 1 }, cond, loadSchema, 'i')).toEqual([])
    expect(conform({ a: 1 }, cond, loadSchema, 'i').join('')).toMatch(/b: declared/)
    expect(conform({ b: 1 }, cond, loadSchema, 'i').length).toBeGreaterThan(0)
  })
  it('a reference into another schema file is followed', () => {
    const ref: JsonSchema = { $ref: 'network.schema.json#/$defs/options' }
    expect(conform(DEFAULT_OPTIONS, ref, loadSchema, 'i')).toEqual([])
    expect(conform({ ...DEFAULT_OPTIONS, speed: 'fast' }, ref, loadSchema, 'i').join('')).toMatch(/speed: expected a finite number/)
  })
})

describe('CONTRACT: the generated file is the schemas', () => {
  it('contract.gen.ts is current: the generator in --check mode exits 0', () => {
    const out = execFileSync(process.execPath, [join(repo, 'frontend', 'scripts', 'gen-contract-types.mjs'), '--check'], { encoding: 'utf8', cwd: join(repo, 'frontend') })
    expect(out).toMatch(/contract types: current/)
  }, 60_000)
  it('every property name any schema declares appears in contract.gen.ts', () => {
    const gen = readFileSync(join(here, 'contract.gen.ts'), 'utf8')
    const names = new Set<string>()
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (typeof node !== 'object' || node === null) return
      const rec = node as Record<string, unknown>
      if (rec.properties && typeof rec.properties === 'object') for (const k of Object.keys(rec.properties)) names.add(k)
      Object.values(rec).forEach(walk)
    }
    for (const f of readdirSync(schemaDir).filter((x) => x.endsWith('.schema.json'))) walk(loadSchema(f))
    expect(names.size).toBeGreaterThan(100)
    const missing = [...names].filter((k) => !new RegExp(`(^|[\\s"'])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\??:`, 'm').test(gen) && !gen.includes(`"${k}"`))
    expect(missing).toEqual([])
  })
})

/** True when `A` and `B` are assignable to each other: the same shape, however each is spelled. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

describe("CONTRACT: the app's types are the generated types", () => {
  it('contracts.ts names are the generated definitions, and the hand types still carried equal the generated ones', () => {
    expectTypeOf<Network>().toEqualTypeOf<Schemas['network']>()
    expectTypeOf<SolveOptions>().toEqualTypeOf<Schemas['options']>()
    expectTypeOf<Result>().toEqualTypeOf<Schemas['result']>()
    expectTypeOf<SensitivityPoint>().toEqualTypeOf<Schemas['sensitivityPoint']>()
    expectTypeOf<CurvePoint>().toEqualTypeOf<Schemas['curvePoint']>()
    expectTypeOf<OptimizationResult>().toEqualTypeOf<Schemas['optimization']>()
    // engine/transport.ts keeps its own interfaces (the module is not generated): each must accept exactly what the
    // schema's type accepts and be accepted by it, in both directions
    expectTypeOf<Mutual<TransportResult, Schemas['TransportResult']>>().toEqualTypeOf<true>()
    expectTypeOf<Mutual<TransportFrame, Schemas['frame']>>().toEqualTypeOf<true>()
    expectTypeOf<Mutual<FlowState, Schemas['flowState']>>().toEqualTypeOf<true>()
    expectTypeOf<Mutual<TransportOptions, Schemas['TransportOptions']>>().toEqualTypeOf<true>()
    // the worker request is the schema's request; a response keeps the per-kind result the schema states with if/then
    expectTypeOf<EngineRequest>().toEqualTypeOf<Schemas['request']>()
    expectTypeOf<EngineResponse>().toMatchTypeOf<Omit<Schemas['response'], 'result'>>()
    expect(true).toBe(true)
  })
})
