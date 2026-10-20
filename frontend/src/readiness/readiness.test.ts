// The consumer and swap test of readiness 1.0.0 (docs/contracts/catalog.md, Missing-data states): the committed
// document and the provider tree's document conform to the schema this side reads, every view's note comes from the
// document (never from a state typed in a view), each of the six states maps to the behavior the catalog names, and a
// document the readiness lists as missing, or a model file it lists as absent, is refused as unavailable with its
// reason instead of drawn empty.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conform, type ContractState, type Readiness, type ReadinessEntry } from '../lib/contract.types'
import { NoteLine } from './ReadinessNote'
import {
  ArtifactUnavailable,
  behavior,
  entryFor,
  loadReadiness,
  modelUnavailable,
  networkAbsent,
  requireAvailable,
  resetReadiness,
  rowUnavailable,
  SEVERITY,
  VIEW_ROWS,
  viewState,
} from './readiness'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const schema = JSON.parse(readFileSync(join(repo, 'docs/contracts/schemas/readiness.schema.json'), 'utf8'))
const load = (file: string) => JSON.parse(readFileSync(join(repo, 'docs/contracts/schemas', file), 'utf8'))
const read = (rel: string): Readiness => JSON.parse(readFileSync(join(repo, rel), 'utf8'))
const committed = read('data/readiness.json')
const fixture = read('docs/contracts/fixtures/data/readiness.json')

const entry = (id: string, state: ContractState, over: Partial<ReadinessEntry> = {}): ReadinessEntry => ({
  id,
  version: '1.0.0',
  status: 'real',
  provenance: state === 'missing' ? null : 'real',
  state,
  reason: state === 'available' ? null : { en: `${id} is ${state}`, es: `${id} está ${state}` },
  missing: state === 'partial' ? ['x/y.json'] : [],
  ...over,
})
const doc = (...entries: ReadinessEntry[]): Readiness => ({
  schema: 'aerovia.readiness/v1',
  product_version: '9.9.9',
  catalog_sha256: '0',
  contracts: entries,
})

describe('the committed documents', () => {
  it.each([
    ['committed build', committed],
    ['provider tree', fixture],
  ])('%s conforms to the readiness schema', (_n, d) => {
    expect(conform(d, schema, load, 'readiness.schema.json')).toEqual([])
  })
  it('every row a view reads is a row of the committed document', () => {
    const ids = committed.contracts.map((c) => c.id)
    for (const [view, rows] of Object.entries(VIEW_ROWS)) {
      expect(rows.length, view).toBeGreaterThan(0)
      for (const id of rows) expect(ids, `${view}: ${id}`).toContain(id)
    }
  })
  it.each([
    ['committed build', committed],
    ['provider tree', fixture],
  ])('%s gives each view the state its rows say', (_n, d) => {
    for (const [view, ids] of Object.entries(VIEW_ROWS)) {
      const rows = ids.map((id) => entryFor(d, id)).filter((e): e is ReadinessEntry => !!e)
      const worst = SEVERITY.find((s) => rows.some((r) => r.state === s)) ?? 'available'
      const got = viewState(d, ids)
      expect(got.state, view).toBe(worst)
      if (got.state !== 'unknown' && got.state !== 'available') {
        expect(got.rows.every((r) => r.state !== 'available' && r.reason !== null), view).toBe(true)
      }
    }
  })
  it('the committed build says available for every row a view reads, so no view shows a note', () => {
    for (const [view, ids] of Object.entries(VIEW_ROWS)) {
      expect(viewState(committed, ids).state, view).toBe('available')
      const html = renderToStaticMarkup(createElement(NoteLine, { view: viewState(committed, ids), lang: 'en' }))
      expect(html, view).toBe('')
    }
  })
  it('the run-time rows are missing in the static document, by the catalog, and no view reads them', () => {
    const runtime = ['engine-worker', 'transport', 'project', 'release-identity']
    for (const id of runtime) {
      expect(entryFor(committed, id)?.state, id).toBe('missing')
      for (const rows of Object.values(VIEW_ROWS)) expect(rows).not.toContain(id)
    }
  })
  it('the provider tree says provider on every document row; the note names the provider from the document', () => {
    for (const view of ['workbench', 'models', 'benchmark', 'experiments']) {
      expect(viewState(fixture, VIEW_ROWS[view]).state, view).toBe('provider')
    }
    const html = renderToStaticMarkup(createElement(NoteLine, { view: viewState(fixture, VIEW_ROWS.workbench), lang: 'en' }))
    expect(html).toContain('data-readiness="provider"')
    expect(html).toContain(fixture.contracts.find((c) => c.id === 'catalog')!.reason!.en)
  })
})

describe('the six states', () => {
  it('adversarial: order: missing, partial, training, provider, stale, available; the most severe wins', () => {
    expect(SEVERITY).toEqual(['missing', 'partial', 'training', 'provider', 'stale', 'available'])
    const d = doc(entry('a', 'stale'), entry('b', 'partial'), entry('c', 'available'))
    expect(viewState(d, ['a', 'b', 'c']).state).toBe('partial')
    expect(viewState(doc(entry('a', 'available')), ['a'])).toEqual({ state: 'available', rows: [] })
  })
  it.each<[ContractState, boolean, boolean]>([
    ['available', true, false],
    ['partial', true, true],
    ['stale', true, true],
    ['provider', true, true],
    ['training', true, true],
    ['missing', false, true],
  ])('%s: shows the result %s, with a note %s', (state, showsResult, note) => {
    expect(behavior(state)).toEqual({ showsResult, note })
    const view = viewState(doc(entry('a', state)), ['a'])
    const html = renderToStaticMarkup(createElement(NoteLine, { view, lang: 'es' }))
    if (note) {
      expect(html).toContain(`data-readiness="${state}"`)
      expect(html).toContain(`a está ${state}`)
    } else {
      expect(html).toBe('')
    }
  })
  it('the note is in the language asked, and names the row ids when several rows speak', () => {
    const d = doc(entry('a', 'partial'), entry('b', 'stale'))
    const en = renderToStaticMarkup(createElement(NoteLine, { view: viewState(d, ['a', 'b']), lang: 'en' }))
    const es = renderToStaticMarkup(createElement(NoteLine, { view: viewState(d, ['a', 'b']), lang: 'es' }))
    expect(en).toContain('Partial build')
    expect(en).toContain('a: a is partial')
    expect(en).toContain('b: b is stale')
    expect(es).toContain('Versión parcial')
    expect(es).toContain('b: b está stale')
  })
  it('a training row names the model that answered, from the document', () => {
    const d = doc(entry('m', 'training', { provenance: 'baseline' }))
    const html = renderToStaticMarkup(createElement(NoteLine, { view: viewState(d, ['m']), lang: 'en' }))
    expect(html).toContain('(baseline)')
  })
  it('a row of the view that is not in the document is ignored; a view with none of its rows is unknown', () => {
    expect(viewState(doc(entry('a', 'stale')), ['a', 'zzz']).state).toBe('stale')
    expect(viewState(doc(entry('a', 'stale')), ['zzz']).state).toBe('unknown')
  })
  it('the note takes no row of its own: a paragraph, never a block of a new kind', () => {
    const html = renderToStaticMarkup(createElement(NoteLine, { view: viewState(doc(entry('a', 'partial')), ['a']), lang: 'en' }))
    expect(html.startsWith('<p ')).toBe(true)
    expect((html.match(/<p /g) ?? []).length).toBe(1)
  })
})

describe('a missing readiness document', () => {
  it('adversarial: a null document is readiness unknown, in both languages', () => {
    const view = viewState(null, VIEW_ROWS.workbench)
    expect(view.state).toBe('unknown')
    expect(renderToStaticMarkup(createElement(NoteLine, { view, lang: 'en' }))).toMatch(/data-readiness="unknown".*Readiness unknown/)
    expect(renderToStaticMarkup(createElement(NoteLine, { view, lang: 'es' }))).toMatch(/data-readiness="unknown".*Disponibilidad desconocida/)
  })
  it('a fetch that fails resolves to null, names the cause on the console, and is asked for once', async () => {
    resetReadiness()
    const fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetch)
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(loadReadiness()).resolves.toBeNull()
    await expect(loadReadiness()).resolves.toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(err.mock.calls.flat().join(' ')).toMatch(/readiness\.json: HTTP 404/)
    err.mockRestore()
  })
  it('a document without contracts is treated as unreadable', async () => {
    resetReadiness()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) })))
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(loadReadiness()).resolves.toBeNull()
    err.mockRestore()
  })
})

describe('a document or a file the readiness lists as unavailable', () => {
  beforeEach(() => resetReadiness())
  afterEach(() => vi.unstubAllGlobals())
  const serve = (readiness: unknown) => {
    const fetch = vi.fn(async (url: string) => {
      const ok = String(url).endsWith('data/readiness.json')
      return { ok, status: ok ? 200 : 404, json: async () => readiness }
    })
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('rowUnavailable is the row only while it is missing; partial, stale and provider still show the result', () => {
    const d = doc(entry('catalog', 'missing'), entry('science', 'partial'), entry('model-registry', 'stale'), entry('browser-evidence', 'provider'))
    expect(rowUnavailable(d, 'catalog')?.id).toBe('catalog')
    for (const id of ['science', 'model-registry', 'browser-evidence']) expect(rowUnavailable(d, id), id).toBeNull()
    expect(rowUnavailable(d, 'zzz')).toBeNull()
    expect(rowUnavailable(null, 'catalog')).toBeNull()
  })
  it('modelUnavailable finds a model file a row lists as absent, relative to data/models/', () => {
    const d = doc(entry('model-io', 'partial', { missing: ['graph-surrogate/room-pillar.onnx'] }), entry('checkpoint', 'available'))
    expect(modelUnavailable(d, 'graph-surrogate/room-pillar.onnx')?.id).toBe('model-io')
    expect(modelUnavailable(d, 'topology-mlp/room-pillar.onnx')).toBeNull()
    expect(modelUnavailable(null, 'graph-surrogate/room-pillar.onnx')).toBeNull()
  })
  it('networkAbsent lists the networks the network row says are absent', () => {
    const d = doc(entry('network', 'partial', { missing: ['room-pillar'] }))
    expect(networkAbsent(d, 'room-pillar')).toBe(true)
    expect(networkAbsent(d, 'other')).toBe(false)
    expect(networkAbsent(null, 'room-pillar')).toBe(false)
  })
  it('adversarial: requireAvailable rejects with ArtifactUnavailable naming the row and the reason in both languages', async () => {
    serve(doc(entry('catalog', 'missing')))
    const e = await requireAvailable(['catalog']).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(ArtifactUnavailable)
    expect((e as ArtifactUnavailable).row).toBe('catalog')
    expect((e as ArtifactUnavailable).reason.en).toContain('catalog')
    expect((e as ArtifactUnavailable).reason.es).toContain('catalog')
    expect((e as ArtifactUnavailable).message).toContain('catalog is missing')
  })
  it('requireAvailable resolves when the rows are available or stale, and when the document is unreadable', async () => {
    serve(doc(entry('catalog', 'stale'), entry('science', 'available')))
    await expect(requireAvailable(['catalog', 'science'])).resolves.toBeUndefined()
    resetReadiness()
    serve({ nope: 1 })
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(requireAvailable(['catalog'])).resolves.toBeUndefined()
    err.mockRestore()
  })
})

describe("the build's copy step (scripts/copy-data.mjs)", () => {
  // scratch trees live in the tool cache of node_modules (ignored by git), never in the system temp
  const scratch = join(repo, 'frontend', 'node_modules', '.cache', 'aerovia-copy-data-test')
  const script = join(repo, 'frontend', 'scripts', 'copy-data.mjs')
  const run = (dataRoot: string) => {
    const out = join(scratch, 'out')
    rmSync(out, { recursive: true, force: true })
    try {
      const stdout = execFileSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, CAOS_DATA_ROOT: dataRoot, CAOS_DATA_OUT: out }, stdio: ['ignore', 'pipe', 'pipe'] })
      return { code: 0, stdout, stderr: '', out }
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string }
      return { code: err.status, stdout: err.stdout, stderr: err.stderr, out }
    }
  }
  beforeEach(() => {
    rmSync(scratch, { recursive: true, force: true })
    mkdirSync(scratch, { recursive: true })
  })
  afterEach(() => rmSync(scratch, { recursive: true, force: true }))

  it.each([
    ['the committed build', 'data'],
    ['the provider tree', 'docs/contracts/fixtures/data'],
  ])('copies the readiness document of %s unchanged', (_n, rel) => {
    const r = run(join(repo, rel))
    expect(r.code).toBe(0)
    expect(readFileSync(join(r.out, 'readiness.json'), 'utf8')).toBe(readFileSync(join(repo, rel, 'readiness.json'), 'utf8'))
    expect(r.stdout).toMatch(/readiness\.json: 16 rows/)
  })
  it('adversarial: stops, naming the root, when the document is absent', () => {
    const root = join(scratch, 'empty')
    mkdirSync(root)
    const r = run(root)
    expect(r.code).toBe(1)
    expect(r.stderr).toMatch(/readiness\.json is missing under .*empty/)
    expect(existsSync(join(r.out, 'readiness.json'))).toBe(false)
  })
  it('adversarial: stops on a document that is not JSON, and on one that is not a readiness document', () => {
    const root = join(scratch, 'bad')
    mkdirSync(root)
    writeFileSync(join(root, 'readiness.json'), '{ nope')
    expect(run(root)).toMatchObject({ code: 1, stderr: expect.stringMatching(/not valid JSON/) })
    writeFileSync(join(root, 'readiness.json'), JSON.stringify({ schema: 'other/v1', contracts: [] }))
    expect(run(root)).toMatchObject({ code: 1, stderr: expect.stringMatching(/not an aerovia\.readiness\/v1 document/) })
  })
  it('a partial document is copied as it is: the build carries the state, the views say it', () => {
    const root = join(scratch, 'partial')
    mkdirSync(root)
    cpSync(join(repo, 'data', 'readiness.json'), join(root, 'readiness.json'))
    const d = JSON.parse(readFileSync(join(root, 'readiness.json'), 'utf8')) as Readiness
    d.contracts[0] = { ...d.contracts[0], state: 'partial', reason: { en: 'x', es: 'y' }, missing: ['room-pillar'] }
    writeFileSync(join(root, 'readiness.json'), JSON.stringify(d))
    const r = run(root)
    expect(r.code).toBe(0)
    expect((JSON.parse(readFileSync(join(r.out, 'readiness.json'), 'utf8')) as Readiness).contracts[0].state).toBe('partial')
  })
})
