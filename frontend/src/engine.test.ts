import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Network, Result } from './contracts'
import { curve, DEFAULT_OPTIONS, optimizeSpeed, sensitivity, solveNetwork, validateNetwork } from './engine'
import { dispatch } from './engine/worker'

const label = (en: string) => ({ en, es: en })
function series(): Network {
  return {
    schema: 'aerovia.network/v1', id: 'analytic-series', name: label('Analytic series'), description: label('Three series resistances and one quadratic fan.'),
    provenance: { kind: 'authored', source: 'Closed-form test fixture', license: 'Apache-2.0' },
    nodes: [{ id: 'a', x: 0, y: 0, z: 0, boundary: 0 }, { id: 'b', x: 1, y: 0, z: 0 }, { id: 'c', x: 2, y: 0, z: 0 }, { id: 'd', x: 3, y: 0, z: 0, boundary: 0 }],
    edges: [
      { id: 'fan', from: 'a', to: 'b', name: label('Fan'), kind: 'fan', area: 10, resistance: 0.01, target: 0, level: 0, fan: { pressure: 800, coefficient: 0.02, efficiency: 0.8 } },
      { id: 'working', from: 'b', to: 'c', name: label('Working'), kind: 'working', area: 8, resistance: 0.12, target: 50, level: 0 },
      { id: 'return', from: 'c', to: 'd', name: label('Return'), kind: 'return', area: 12, resistance: 0.05, target: 0, level: 0 },
    ],
  }
}
const solve = (network: Network) => solveNetwork(network, DEFAULT_OPTIONS)
function verified(result: Result) {
  expect(result.converged, result.message).toBe(true)
  expect(result.massResidual).toBeLessThanOrEqual(1e-6)
  expect(result.pressureResidual).toBeLessThanOrEqual(1e-5)
  expect(result.flows.every(Number.isFinite)).toBe(true)
}

describe('exact physical fixtures', () => {
  it('matches the series resistance, pressure, velocity and electrical-power solution', () => {
    const result = solve(series()), q = Math.sqrt(800 / 0.2)
    verified(result)
    result.flows.forEach(flow => expect(flow).toBeCloseTo(q, 6))
    expect(result.pressures[1]).toBeCloseTo(680, 5)
    expect(result.pressures[2]).toBeCloseTo(200, 5)
    expect(result.velocities[1]).toBeCloseTo(q / 8, 7)
    expect(result.fanPowerKW).toBeCloseTo(720 * q / 0.8 / 1000, 6)
    expect(result.totalIntake).toBeCloseTo(q, 6)
    expect(result.targetRatio).toBeCloseTo(q / 50, 7)
  })
  it('matches parallel resistance and flow distribution', () => {
    const network = series()
    network.edges[1] = { ...network.edges[1], to: 'd', resistance: 0.1 }
    network.edges[2] = { ...network.edges[2], from: 'b', resistance: 0.4 }
    network.nodes = network.nodes.filter(n => n.id !== 'c')
    const result = solve(network), q = Math.sqrt(800 / (0.03 + 0.1 / 2.25))
    verified(result)
    expect(result.flows[0]).toBeCloseTo(q, 6)
    expect(result.flows[1]).toBeCloseTo(q * 2 / 3, 6)
    expect(result.flows[2]).toBeCloseTo(q / 3, 6)
  })
  it('has exactly zero flow and zero power with the fan off', () => {
    const result = solveNetwork(series(), { ...DEFAULT_OPTIONS, speed: 0 })
    verified(result)
    expect(result.flows).toEqual([0, 0, 0])
    expect(result.fanPowerKW).toBe(0)
    expect(result.shortfalls).toEqual([0, 50, 0])
  })
  it('preserves the physical solution when a passive edge orientation is reversed', () => {
    const network = series(), original = solve(network)
    network.edges[1] = { ...network.edges[1], from: 'c', to: 'b', target: 0 }
    const result = solve(network)
    verified(result)
    expect(result.flows[1]).toBeCloseTo(-original.flows[1], 6)
    result.pressures.forEach((p, i) => expect(p).toBeCloseTo(original.pressures[i], 6))
    expect(result.fanPowerKW).toBeCloseTo(original.fanPowerKW, 6)
  })
  it('obeys common-speed flow, pressure and fan cube laws', () => {
    const full = solve(series()), half = solveNetwork(series(), { ...DEFAULT_OPTIONS, speed: 0.5 })
    verified(half)
    expect(half.totalIntake).toBeCloseTo(full.totalIntake * 0.5, 6)
    expect(half.pressures[1]).toBeCloseTo(full.pressures[1] * 0.25, 6)
    expect(half.fanPowerKW).toBeCloseTo(full.fanPowerKW * 0.125, 6)
  })
  it('conserves at a dead end and a zero-flow branch', () => {
    const network = series()
    network.nodes.push({ id: 'dead', x: 1, y: 1, z: 0 })
    network.edges.push({ ...network.edges[1], id: 'dead-end', to: 'dead', target: 0 })
    const result = solve(network)
    verified(result)
    expect(Math.abs(result.flows[3])).toBeLessThan(1e-6)
  })
  it('solves a passive pressure-driven path and maintains a shared pressure offset', () => {
    const network = series()
    network.edges[0] = { ...network.edges[0], kind: 'intake', fan: undefined }
    delete network.edges[0].fan
    network.nodes[0].boundary = 1000
    const base = solve(network)
    verified(base)
    expect(base.totalIntake).toBeCloseTo(Math.sqrt(1000 / 0.18), 6)
    network.nodes[0].boundary = 501000; network.nodes[3].boundary = 500000
    const offset = solve(network)
    verified(offset)
    expect(offset.totalIntake).toBeCloseTo(base.totalIntake, 6)
    offset.pressures.forEach((p, i) => expect(p - 500000).toBeCloseTo(base.pressures[i], 5))
  })
  it('preserves energy across the passive losses and delivered fan power', () => {
    const network = series(), result = solve(network)
    const dissipated = network.edges.reduce((sum, edge, i) => sum + edge.resistance * Math.abs(result.flows[i]) ** 3, 0)
    expect(result.fanPowerKW * 1000 * network.edges[0].fan!.efficiency).toBeCloseTo(dissipated, 3)
  })
  it('resolves a symmetric zero-flow bridge without an artificial leak', () => {
    const network = series()
    network.edges[1].resistance = 0.1; network.edges[2].resistance = 0.1
    network.nodes.push({ id: 'c2', x: 2, y: 1, z: 0 })
    network.edges.push({ ...network.edges[1], id: 'parallel-in', to: 'c2', target: 0 })
    network.edges.push({ ...network.edges[2], id: 'parallel-out', from: 'c2' })
    network.edges.push({ ...network.edges[1], id: 'bridge', from: 'c', to: 'c2', resistance: 1e-6, target: 0 })
    const result = solve(network)
    verified(result)
    expect(Math.abs(result.flows[5])).toBeLessThan(1e-6)
    expect(result.flows[1]).toBeCloseTo(result.flows[3], 6)
  })
  it('handles separate grounded components without mixing their pressure gauges', () => {
    const network = series()
    network.nodes.push({ id: 'e', x: 10, y: 0, z: 0, boundary: 100 }, { id: 'f', x: 11, y: 0, z: 0, boundary: 0 })
    network.edges.push({ ...network.edges[2], id: 'separate', from: 'e', to: 'f', resistance: 1 })
    const result = solve(network)
    verified(result)
    expect(result.flows[3]).toBeCloseTo(10, 8)
    expect(result.totalIntake).toBeCloseTo(Math.sqrt(800 / 0.2) + 10, 6)
  })
})

describe('input and unsupported-state handling', () => {
  it.each(['resistance', 'area', 'target'] as const)('rejects a non-finite %s', field => {
    const network = series(); network.edges[1][field] = NaN
    expect(() => solve(network)).toThrow(/finite/)
  })
  it('rejects zero resistance, duplicate IDs, unknown endpoints and absent boundaries', () => {
    const zero = series(); zero.edges[1].resistance = 0
    expect(() => solve(zero)).toThrow(/resistance/)
    const duplicate = series(); duplicate.nodes[1].id = 'a'
    expect(() => solve(duplicate)).toThrow(/unique/)
    const unknown = series(); unknown.edges[0].to = 'missing'
    expect(() => solve(unknown)).toThrow(/unknown node/)
    const noBoundary = series(); noBoundary.nodes.forEach(n => { delete n.boundary })
    expect(() => solve(noBoundary)).toThrow(/boundary/)
  })
  it('rejects subnormal positive targets that cannot produce a finite compliance ratio', () => {
    const network = series(); network.edges[1].target = Number.MIN_VALUE
    expect(() => solve(network)).toThrow(/at least/)
  })
  it('rejects floating imported nodes and unsupported sizes', () => {
    const floating = series(); floating.nodes.push({ id: 'orphan', x: 1, y: 1, z: 1 })
    expect(() => solve(floating)).toThrow(/no path/)
    const large = series(); large.nodes = Array.from({ length: 121 }, (_, i) => ({ id: `n${i}`, x: i, y: 0, z: 0 }))
    expect(() => solve(large)).toThrow(/120/)
  })
  it('rejects invalid options rather than clamping scientific inputs', () => {
    expect(() => solveNetwork(series(), { ...DEFAULT_OPTIONS, speed: 1.51 })).toThrow(/speed/)
    expect(() => solveNetwork(series(), { ...DEFAULT_OPTIONS, overrides: { missing: { closed: true } } })).toThrow(/unknown edge/)
    expect(() => solveNetwork(series(), { ...DEFAULT_OPTIONS, overrides: { working: { area: 0 } } })).toThrow(/area/)
  })
  it('returns an explicit failure if airway closures isolate internal nodes', () => {
    const result = solveNetwork(series(), { ...DEFAULT_OPTIONS, overrides: { fan: { closed: true }, return: { closed: true } } })
    expect(result.converged).toBe(false)
    expect(result.message).toMatch(/isolate/)
    expect(result.iterations).toBe(0)
  })
  it('does not treat a closed targeted working as target-compliant', () => {
    const result = solveNetwork(series(), { ...DEFAULT_OPTIONS, overrides: { working: { closed: true } } })
    verified(result)
    expect(result.flows[1]).toBe(0)
    expect(result.shortfalls[1]).toBe(50)
    expect(result.targetRatio).toBe(0)
  })
  it('flags reverse fan operation instead of inventing useful fan power', () => {
    const network = series(); network.nodes[3].boundary = 2000
    const result = solve(network)
    expect(result.converged).toBe(false)
    expect(result.message).toMatch(/Fan reverse/)
    expect(result.fanPowerKW).toBe(0)
  })
  it('flags forward fan operation with negative delivered pressure', () => {
    const network = series(); network.nodes[0].boundary = 100000
    const result = solve(network)
    expect(result.converged).toBe(false)
    expect(result.message).toMatch(/negative pressure/)
    expect(result.fanPowerKW).toBe(0)
  })
  it('round-trips validated JSON and preserves caller-owned values', () => {
    const input = series(), snapshot = JSON.stringify(input)
    const roundTrip = validateNetwork(JSON.parse(snapshot))
    solveNetwork(input, { ...DEFAULT_OPTIONS, overrides: { working: { resistance: 0.3, area: 20 } } })
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(roundTrip).toEqual(input)
    expect(validateNetwork({ ...input, privateMetadata: 'discarded' })).not.toHaveProperty('privateMetadata')
  })
})

describe('decision operations', () => {
  it('finds the known minimum feasible common fan speed', () => {
    const optimized = optimizeSpeed(series(), DEFAULT_OPTIONS)
    expect(optimized.feasible).toBe(true)
    verified(optimized.result)
    expect(optimized.speed).toBeCloseTo(50 / Math.sqrt(800 / 0.2), 6)
    expect(optimized.result.targetRatio).toBeGreaterThanOrEqual(1)
  })
  it('reports infeasible targets and no-target zero demand', () => {
    const network = series(); network.edges[1].target = 1000
    expect(optimizeSpeed(network, DEFAULT_OPTIONS).feasible).toBe(false)
    network.edges[1].target = 0
    const result = optimizeSpeed(network, DEFAULT_OPTIONS)
    expect(result.feasible).toBe(true)
    expect(result.speed).toBe(0)
  })
  it('does not assert a monotone optimum with unequal boundary pressures', () => {
    const network = series(); network.nodes[0].boundary = 100
    const result = optimizeSpeed(network, DEFAULT_OPTIONS)
    expect(result.feasible).toBe(false)
    expect(result.result.message).toMatch(/equal boundary pressures/)
  })
  it('computes resistance sensitivity against a closed-form perturbation', () => {
    const points = sensitivity(series(), DEFAULT_OPTIONS), point = points.find(p => p.edgeId === 'working')!
    const base = Math.sqrt(800 / 0.2), changed = Math.sqrt(800 / (0.2 + 0.12 * 0.05))
    expect(point.flowDelta).toBeCloseTo(changed - base, 6)
    expect(point.elasticity).toBeCloseTo((changed - base) / base / 0.05, 5)
  })
  it('generates a fan sweep from actual solutions including zero and maximum speed', () => {
    const points = curve(series(), DEFAULT_OPTIONS), baseline = solve(series())
    expect(points).toHaveLength(21)
    expect(points[0]).toMatchObject({ speed: 0, power: 0, flow: 0, pressure: 0 })
    expect(points[20].speed).toBe(1.5)
    expect(points[20].power).toBeCloseTo(baseline.fanPowerKW * 1.5 ** 3, 5)
    expect(points[20].pressure).toBeCloseTo(720 * 1.5 ** 2, 5)
  })
  it('dispatches worker operations with request IDs and safe validation errors', () => {
    const response = dispatch({ id: 7, kind: 'solve', network: series(), options: DEFAULT_OPTIONS })
    expect(response.id).toBe(7)
    expect((response.result as Result).converged).toBe(true)
    const invalid = series(); invalid.edges[0].resistance = -2
    expect(dispatch({ id: 8, kind: 'solve', network: invalid, options: DEFAULT_OPTIONS }).error).toMatch(/resistance/)
  })
})

const casePath = resolve(process.cwd(), '../data/cases.json')
describe('authored case matrix', () => {
  const cases: Network[] = existsSync(casePath) ? JSON.parse(readFileSync(casePath, 'utf-8')) : []
  it('includes the complete twelve-case library', () => { expect(cases).toHaveLength(12) })
  it.each(cases.map(network => [network.id, network] as const))('closes the SI equations for %s', (_, network) => {
    for (const speed of [0, 0.35, 1, 1.5]) verified(solveNetwork(network, { ...DEFAULT_OPTIONS, speed }))
  })
  it('maintains conservation under branch regulation and target/area interventions', () => {
    for (const network of cases) {
      const working = network.edges.find(e => e.kind === 'working')!
      const result = solveNetwork(network, { speed: 0.8, resistanceScale: 1.7, overrides: { [working.id]: { resistance: working.resistance * 3, area: working.area * 1.2, target: working.target * 1.1 } } })
      verified(result)
    }
  })
  it('solves a connected network at the 120-node / 240-edge browser limits', () => {
    const network = series()
    network.nodes = Array.from({ length: 120 }, (_, i) => ({ id: `n${i}`, x: i % 12, y: Math.floor(i / 12), z: 0, ...(i === 0 || i === 119 ? { boundary: 0 } : {}) }))
    network.edges = []
    const add = (from: number, to: number) => {
      const i = network.edges.length
      network.edges.push({ id: `e${i}`, from: `n${from}`, to: `n${to}`, name: label(`Airway ${i}`), kind: 'crosscut', resistance: 0.015 + (i * 17 % 97) / 100, area: 10, target: 0, level: 0 })
    }
    for (let i = 0; i < 120; i++) {
      if (i % 12 < 11) add(i, i + 1)
      if (i + 12 < 120) add(i, i + 12)
    }
    for (let i = 0; network.edges.length < 240; i++) add(i, i + 13)
    network.edges[0] = { ...network.edges[0], kind: 'fan', fan: { pressure: 800, coefficient: 0.02, efficiency: 0.8 } }
    verified(solve(network))
  })
})

describe('independent SciPy parity', () => {
  const published = resolve(process.cwd(), '../data/artifacts/catalog.json')
  const reference = existsSync(published) ? published : resolve(process.cwd(), '../build/local/reference/catalog.json')
  type ReferenceCase = { network: Network; options: typeof DEFAULT_OPTIONS; sourceSha256: string; result: Result }
  const artifact: { cases: ReferenceCase[] } = existsSync(reference) ? JSON.parse(readFileSync(reference, 'utf-8')) : { cases: [] }
  it('requires a complete numerical reference artifact', () => { expect(artifact.cases).toHaveLength(12) })
  it.each(artifact.cases.map(entry => [entry.network.id, entry] as const))('matches independent flow, pressure and power for %s', (_, entry) => {
    expect(entry.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    const computed = solveNetwork(entry.network, entry.options)
    verified(computed); verified(entry.result)
    computed.flows.forEach((q, i) => expect(Math.abs(q - entry.result.flows[i])).toBeLessThan(2e-6))
    computed.pressures.forEach((p, i) => expect(Math.abs(p - entry.result.pressures[i])).toBeLessThan(1e-4))
    expect(Math.abs(computed.fanPowerKW - entry.result.fanPowerKW)).toBeLessThan(1e-5)
    expect(Math.abs(computed.totalIntake - entry.result.totalIntake)).toBeLessThan(2e-6)
    expect(Math.abs(computed.targetRatio - entry.result.targetRatio)).toBeLessThan(1e-6)
  })
})
