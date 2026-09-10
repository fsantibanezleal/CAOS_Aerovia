import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Network } from './contracts'
import { DEFAULT_OPTIONS, solveNetwork } from './engine'
import { csvCell, download, parseProject, persistProject, PROJECT_STORAGE_KEY, readPreference, readSaved, serializeProject, validateProject, type ProjectInputs } from './storage'

const cases: Network[] = JSON.parse(readFileSync(resolve(process.cwd(), '../data/cases.json'), 'utf-8'))
function example(): ProjectInputs {
  const network = structuredClone(cases[0])
  const edge = network.edges.find(e => e.kind === 'working')!
  return {
    schema: 'aerovia.project/v1', network,
    options: { speed: 0.82, resistanceScale: 1.3, overrides: { [edge.id]: { resistance: edge.resistance * 1.7, area: edge.area * 1.1, target: edge.target * 1.2, closed: true } } },
    baseline: { network: structuredClone(network), options: structuredClone(DEFAULT_OPTIONS) },
    savedAt: '2026-09-09T00:00:00.000Z',
  }
}
function memoryStorage(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [[PROJECT_STORAGE_KEY, initial]])
  return { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value) }) }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('scientific project round-trip', () => {
  it('preserves absolute overrides, closed airways, speed and global resistance for the local pipeline', () => {
    const original = example(), restored = parseProject(serializeProject(original))
    expect(restored.network).toEqual(original.network)
    expect(restored.options).toEqual(original.options)
    const before = solveNetwork(original.network, original.options), after = solveNetwork(restored.network, restored.options)
    expect(after.flows).toEqual(before.flows)
    expect(after.fanPowerKW).toBe(before.fanPowerKW)
    expect(after.targetRatio).toBe(before.targetRatio)
    expect(restored.baseline?.result.converged).toBe(true)
  })
  it('never accepts forged baseline result arrays or a forged convergence claim', () => {
    const project = example()
    const restored = validateProject({ ...project, baseline: { ...project.baseline, result: { converged: true, flows: [1e90], pressures: [-1e90], fanPowerKW: -2000, targetRatio: 9999 } } })
    const reference = solveNetwork(project.baseline!.network, project.baseline!.options)
    expect(restored.baseline!.result.flows).toEqual(reference.flows)
    expect(restored.baseline!.result.fanPowerKW).toBe(reference.fanPowerKW)
    expect(restored.baseline!.result.flows).toHaveLength(project.network.edges.length)
  })
  it('stores baseline inputs without derived result arrays and recomputes them on device restore', () => {
    const store = memoryStorage(), project = validateProject(example())
    persistProject(project, store)
    const raw = JSON.parse(store.getItem(PROJECT_STORAGE_KEY)!)
    expect(raw.baseline).not.toHaveProperty('result')
    expect(raw.baseline.options).toEqual(project.baseline!.options)
    expect(readSaved(store)?.baseline?.result.flows).toEqual(project.baseline!.result.flows)
  })
  it('retains a disconnected current intervention as a repairable draft', () => {
    const project = example()
    project.options.overrides = Object.fromEntries(project.network.edges.map(edge => [edge.id, { closed: true }]))
    expect(solveNetwork(project.network, project.options).converged).toBe(false)
    const restored = parseProject(serializeProject(project))
    expect(restored.options).toEqual(project.options)
    expect(restored.baseline?.result.converged).toBe(true)
  })
  it('rejects an unsupported saved baseline rather than displaying invented comparisons', () => {
    const project = example()
    project.baseline!.options.overrides = Object.fromEntries(project.network.edges.map(edge => [edge.id, { closed: true }]))
    expect(() => validateProject(project)).toThrow(/Saved baseline cannot be restored/)
  })
  it('rejects malformed underlying baseline inputs even if the supplied results look valid', () => {
    const project = example()
    project.baseline!.options.speed = -1
    expect(() => validateProject(project)).toThrow(/speed/)
  })
})

describe('private, defensive persistence', () => {
  it('allowlists scientific project fields and adds no source path or account metadata', () => {
    const project = example()
    const withMetadata = {
      ...project, localPath: 'discard-this-path', account: 'discard-this-account',
      network: { ...project.network, originalFile: 'discard-this-file' },
      options: { ...project.options, device: 'discard-this-device' },
      baseline: { ...project.baseline!, result: { privateNotes: 'discard-this-result' } },
    }
    const text = serializeProject(withMetadata)
    expect(text).not.toContain('discard-this')
    expect(JSON.parse(text).network.provenance).toEqual(project.network.provenance)
    expect(Object.keys(JSON.parse(text))).toEqual(['schema', 'network', 'options', 'baseline', 'savedAt'])
  })
  it('does not mutate caller-owned project or baseline state', () => {
    const project = example(), snapshot = JSON.stringify(project)
    serializeProject(project); validateProject(project)
    expect(JSON.stringify(project)).toBe(snapshot)
  })
  it('preserves the old stored workspace when validation fails before a write', () => {
    const previous = serializeProject(example()), store = memoryStorage(previous), invalid = example()
    invalid.network.edges[0].resistance = -1
    expect(() => persistProject(invalid, store)).toThrow(/resistance/)
    expect(store.setItem).not.toHaveBeenCalled()
    expect(store.getItem(PROJECT_STORAGE_KEY)).toBe(previous)
  })
  it('lets quota and security write errors reach the UI without clearing old state', () => {
    const store = { setItem: () => { throw new Error('storage unavailable') } }
    expect(() => persistProject(example(), store)).toThrow(/storage unavailable/)
  })
  it('recovers a fresh workspace from missing, blocked, malformed or invalid device storage', () => {
    expect(readSaved(memoryStorage())).toBeNull()
    expect(readSaved(memoryStorage('{'))).toBeNull()
    expect(readSaved({ getItem: () => { throw new Error('blocked') } })).toBeNull()
    const invalid = example(); invalid.options.overrides = { unknown: { closed: true } }
    expect(readSaved(memoryStorage(JSON.stringify(invalid)))).toBeNull()
  })
  it('reads appearance preferences safely when browser storage is blocked', () => {
    expect(readPreference('lang', { getItem: () => { throw new Error('blocked') } })).toBeNull()
    const store = memoryStorage(); store.setItem('aerovia.theme', 'dark')
    expect(readPreference('theme', store)).toBe('dark')
  })
  it('reports version, timestamp and JSON failures explicitly', () => {
    expect(() => validateProject({ ...example(), schema: 'aerovia.project/v2' })).toThrow(/schema/)
    expect(() => validateProject({ ...example(), savedAt: '2026-02-30T00:00:00Z' })).toThrow(/calendar/)
    expect(() => validateProject({ ...example(), savedAt: 'yesterday' })).toThrow(/timestamp/)
    expect(() => parseProject('{broken')).toThrow(/valid JSON/)
  })
  it('measures the UTF-8 import budget before JSON parsing', () => {
    // One million two-byte characters exceeds 2 MiB once the count reaches 1.1m,
    // despite staying below that limit when measured as JavaScript characters.
    expect(() => parseProject('é'.repeat(1_100_000))).toThrow(/2 MiB/)
  })
})

describe('portable downloads', () => {
  it('quotes commas, newlines and quotation marks while keeping signed numeric values numeric', () => {
    expect(csvCell('A,"B"\nC')).toBe('"A,""B""\nC"')
    expect(csvCell(-12.5)).toBe('"-12.5"')
    expect(csvCell(null)).toBe('""')
  })
  it.each(['=1+1', '+SUM(A1:A2)', '@SUM(A1)', '-2+3', ' \t=1+1', '\n=1+1'])('neutralizes text that spreadsheet software could evaluate: %s', text => {
    expect(csvCell(text)).toBe(`"'${text}"`)
  })
  it('releases its object URL and removes temporary download elements', () => {
    vi.useFakeTimers()
    const link = { href: '', download: '', hidden: false, click: vi.fn(), remove: vi.fn() }
    const appendChild = vi.fn()
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild } })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-export')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    download('../airway:project.json', '{}')
    expect(link.download).not.toMatch(/[/:\\]/)
    expect(appendChild).toHaveBeenCalledWith(link)
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.remove).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(2000)
    expect(revoke).toHaveBeenCalledWith('blob:test-export')
  })
})
