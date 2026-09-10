import type { Network, Result, SolveOptions } from '../contracts'
import { solveLinear } from './linear'
import { ungroundedNodes, validateNetwork, validateOptions } from './validation'

export const DEFAULT_OPTIONS: SolveOptions = Object.freeze({ speed: 1, resistanceScale: 1, overrides: Object.freeze({}) })
export const ENGINE_VERSION = '1.0.0'
export const MASS_TOLERANCE = 1e-6
export const PRESSURE_TOLERANCE = 1e-5

interface Branch { from: number; to: number; resistance: number; source: number; closed: boolean }

/**
 * Steady, constant-density ventilation network. Signed nodal pressure formulation;
 * continuation removes the inverse square-root derivative singularity at zero flow.
 * Acceptance always checks the original (unsmoothed) SI equations.
 */
export function solveNetwork(input: Network, suppliedOptions: SolveOptions = DEFAULT_OPTIONS): Result {
  const started = performance.now()
  const network = validateNetwork(input)
  const options = validateOptions(suppliedOptions, network)
  return solveValidated(network, options, started)
}

/** Internal entry point for bounded sweeps after one immutable input validation. */
export function solveValidated(network: Network, options: SolveOptions, started = performance.now()): Result {
  const nodeIndex = new Map(network.nodes.map((node, i) => [node.id, i]))
  const internal = network.nodes.map((node, i) => node.boundary === undefined ? i : -1).filter(i => i >= 0)
  const unknownIndex = new Int32Array(network.nodes.length).fill(-1)
  internal.forEach((i, j) => { unknownIndex[i] = j })
  const closed = new Set(network.edges.filter(edge => options.overrides[edge.id]?.closed).map(edge => edge.id))
  const floating = ungroundedNodes(network, closed)
  const targets = network.edges.map(e => options.overrides[e.id]?.target ?? e.target)
  if (floating.length) return {
    schema: 'aerovia.result/v1', converged: false, iterations: 0, massResidual: 0, pressureResidual: 0,
    flows: network.edges.map(() => 0), pressures: network.nodes.map(n => n.boundary ?? 0), velocities: network.edges.map(() => 0),
    fanPowerKW: 0, totalIntake: 0, targetRatio: targets.some(t => t > 0) ? 0 : 1, shortfalls: targets,
    elapsedMs: performance.now() - started,
    message: `Closed airways isolate nodes from every pressure boundary: ${floating.slice(0, 8).join(', ')}. No solution was calculated; reopen a connection.`,
  }
  const branches: Branch[] = network.edges.map(edge => ({
    from: nodeIndex.get(edge.from)!, to: nodeIndex.get(edge.to)!,
    resistance: (options.overrides[edge.id]?.resistance ?? edge.resistance) * options.resistanceScale + (edge.fan?.coefficient ?? 0),
    source: (edge.fan?.pressure ?? 0) * options.speed ** 2,
    closed: closed.has(edge.id),
  }))
  const pressureOffset = network.nodes.find(n => n.boundary !== undefined)!.boundary!
  const pressureScale = Math.max(1, ...branches.map(b => b.source), ...network.nodes.map(n => Math.abs((n.boundary ?? pressureOffset) - pressureOffset)))
  const coefficients = branches.filter(b => !b.closed).map(b => b.resistance).sort((a, b) => a - b)
  const resistanceScale = coefficients[Math.floor(coefficients.length / 2)] ?? 1
  const flowScale = Math.sqrt(pressureScale / resistanceScale)
  const p = new Float64Array(network.nodes.map(node => ((node.boundary ?? pressureOffset) - pressureOffset) / pressureScale))
  const size = internal.length
  let iterations = 0
  let numericalIssue = ''

  function evaluate(pressures: Float64Array, epsilon: number, needMatrix: boolean) {
    const residual = new Float64Array(size)
    const jacobian = needMatrix ? new Float64Array(size * size) : new Float64Array(0)
    let energy = 0
    for (const branch of branches) {
      if (branch.closed) continue
      const head = pressures[branch.from] - pressures[branch.to] + branch.source / pressureScale
      const rootR = Math.sqrt(branch.resistance / resistanceScale)
      const square = head * head + epsilon * epsilon
      const denominator = Math.pow(square, 0.25)
      const q = square === 0 ? 0 : head / (rootR * denominator)
      const derivative = square === 0 ? 1 / (rootR * 1e-7) : (0.5 * head * head + epsilon * epsilon) / (rootR * Math.pow(square, 1.25))
      const u = unknownIndex[branch.from], v = unknownIndex[branch.to]
      if (u >= 0) residual[u] += q
      if (v >= 0) residual[v] -= q
      if (needMatrix) {
        if (u >= 0) jacobian[u * size + u] += derivative
        if (v >= 0) jacobian[v * size + v] += derivative
        if (u >= 0 && v >= 0) { jacobian[u * size + v] -= derivative; jacobian[v * size + u] -= derivative }
      }
      energy += (2 / 3) * Math.pow(square, 0.75) / rootR
    }
    let maximum = 0, norm = 0
    for (const value of residual) { maximum = Math.max(maximum, Math.abs(value)); norm += value * value }
    return { residual, jacobian, energy, maximum, norm }
  }

  if (size > 0) {
    // Coarse-to-fine pressure smoothing is in normalized pressure units. The last
    // stage is exact, so neither smoothing nor Newton success can mask an SI error.
    const stages = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10, 1e-12, 0]
    for (const epsilon of stages) {
      const stageTolerance = epsilon === 0 ? MASS_TOLERANCE / flowScale / 4 : Math.max(MASS_TOLERANCE / flowScale / 8, epsilon * 0.01)
      for (let iteration = 0; iteration < 50 && iterations < 240; iteration++) {
        const state = evaluate(p, epsilon, true)
        if (state.maximum <= stageTolerance) break
        iterations++
        const direction = solveLinear(state.jacobian, Float64Array.from(state.residual, value => -value))
        if (!direction) { numericalIssue = 'The pressure system is too ill-conditioned for a reliable browser solution.'; break }
        let accepted = false
        let step = 1
        let slope = 0
        for (let i = 0; i < size; i++) slope += state.residual[i] * direction[i]
        for (let trial = 0; trial < 32; trial++) {
          const candidate = p.slice()
          for (let i = 0; i < size; i++) candidate[internal[i]] += step * direction[i]
          const next = evaluate(candidate, epsilon, false)
          // Residual descent handles cancellation in the energy near convergence.
          const energyDescent = next.energy < state.energy && next.energy <= state.energy + 1e-4 * step * slope
          if (Number.isFinite(next.norm) && (next.norm < state.norm * (1 - 1e-4 * step) || energyDescent)) {
            p.set(candidate); accepted = true; break
          }
          step *= 0.5
        }
        if (!accepted) break
      }
      if (numericalIssue || iterations >= 240) break
    }
  }

  const pressures = Array.from(p, value => value * pressureScale + pressureOffset)
  const flows = branches.map(branch => {
    if (branch.closed) return 0
    // Work in the scaled difference, avoiding unnecessary cancellation when all
    // boundary pressures share a large absolute offset.
    const head = (p[branch.from] - p[branch.to]) * pressureScale + branch.source
    return Math.sign(head) * Math.sqrt(Math.abs(head) / branch.resistance)
  })
  const imbalance = new Float64Array(network.nodes.length)
  let pressureResidual = 0, fanPowerKW = 0
  const unsupportedFans: string[] = []
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i], q = flows[i], edge = network.edges[i]
    if (branch.closed) continue
    imbalance[branch.from] += q; imbalance[branch.to] -= q
    const loss = branch.resistance * q * Math.abs(q)
    pressureResidual = Math.max(pressureResidual, Math.abs(pressures[branch.from] - pressures[branch.to] + branch.source - loss))
    if (edge.fan) {
      const delivery = branch.source - edge.fan.coefficient * q * Math.abs(q)
      if (q < -MASS_TOLERANCE || (q > MASS_TOLERANCE && delivery < -PRESSURE_TOLERANCE)) unsupportedFans.push(edge.id)
      if (q > 0 && delivery > 0) fanPowerKW += delivery * q / (edge.fan.efficiency * 1000)
    }
  }
  const massResidual = internal.reduce((maximum, i) => Math.max(maximum, Math.abs(imbalance[i])), 0)
  const totalIntake = network.nodes.reduce((sum, node, i) => sum + (node.boundary !== undefined ? Math.max(0, imbalance[i]) : 0), 0)
  const velocities = flows.map((q, i) => q / (options.overrides[network.edges[i].id]?.area ?? network.edges[i].area))
  const ratios = targets.flatMap((target, i) => target > 0 ? [flows[i] / target] : [])
  const targetRatio = ratios.length ? Math.min(...ratios) : 1
  const shortfalls = targets.map((target, i) => Math.max(0, target - flows[i]))
  const finite = [...flows, ...pressures, ...velocities, fanPowerKW, massResidual, pressureResidual].every(Number.isFinite)
  const converged = finite && !numericalIssue && !unsupportedFans.length && massResidual <= MASS_TOLERANCE && pressureResidual <= PRESSURE_TOLERANCE
  const message = !finite ? 'Non-finite numerical result; check the resistance and pressure ranges.'
    : numericalIssue || (unsupportedFans.length ? `Fan reverse flow or negative pressure delivery is outside the supported fan model: ${unsupportedFans.join(', ')}.`
      : !converged ? `Solver did not meet equation tolerances after ${iterations} iterations (mass ${massResidual.toExponential(2)} m³/s; pressure ${pressureResidual.toExponential(2)} Pa).` : undefined)
  return { schema: 'aerovia.result/v1', converged, iterations, massResidual, pressureResidual, flows, pressures, velocities, fanPowerKW, totalIntake, targetRatio, shortfalls, elapsedMs: performance.now() - started, ...(message ? { message } : {}) }
}
