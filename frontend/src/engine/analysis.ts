import type { CurvePoint, Network, OptimizationResult, SensitivityPoint, SolveOptions } from '../contracts'
import { solveValidated } from './solver'
import { LIMITS, validateNetwork, validateOptions } from './validation'

/** Lowest common fan speed in [0, 1.5] satisfying all signed branch targets. */
export function optimizeSpeed(input: Network, suppliedOptions: SolveOptions): OptimizationResult {
  const network = validateNetwork(input), options = validateOptions(suppliedOptions, network)
  const boundaries = network.nodes.flatMap(n => n.boundary === undefined ? [] : [n.boundary])
  if (boundaries.some(pressure => pressure !== boundaries[0])) {
    const result = solveValidated(network, options)
    return { feasible: false, speed: options.speed, evaluations: 1, result: { ...result, message: 'Common-speed optimization requires equal boundary pressures. Unequal imposed pressures can make target delivery non-monotone; inspect the speed curve instead.' } }
  }
  let evaluations = 1
  const zero = solveValidated(network, { ...options, speed: 0 })
  const hasTargets = network.edges.some(e => (options.overrides[e.id]?.target ?? e.target) > 0)
  if (!hasTargets && zero.converged) return { feasible: true, speed: 0, result: zero, evaluations }
  const maximum = solveValidated(network, { ...options, speed: LIMITS.maxSpeed }); evaluations++
  if (!maximum.converged || maximum.targetRatio < 1) {
    return { feasible: false, speed: LIMITS.maxSpeed, evaluations, result: { ...maximum, message: maximum.message ?? 'The entered airflow targets are infeasible at the maximum supported common fan speed of 150%.' } }
  }
  // Equal pressure boundaries and quadratic laws make every signed branch flow
  // proportional to common speed. Bisection retains an independently re-solved,
  // feasible upper bound and avoids assuming a particular network topology.
  let low = 0, high: number = LIMITS.maxSpeed, result = maximum
  for (let i = 0; i < 26; i++) {
    const speed = (low + high) / 2
    const candidate = solveValidated(network, { ...options, speed }); evaluations++
    if (candidate.converged && candidate.targetRatio >= 1) { high = speed; result = candidate }
    else low = speed
  }
  return { feasible: true, speed: high, result, evaluations }
}

/**
 * One-at-a-time +5% resistance intervention. Elasticity describes the relative
 * change in the minimum target ratio, divided by 0.05. Deltas are kW and m³/s.
 * Values are local finite differences and include network flow redistribution.
 */
export function sensitivity(input: Network, suppliedOptions: SolveOptions): SensitivityPoint[] {
  const network = validateNetwork(input), options = validateOptions(suppliedOptions, network)
  const baseline = solveValidated(network, options)
  if (!baseline.converged) throw new Error(baseline.message ?? 'Sensitivity needs a converged baseline.')
  const hasTargets = network.edges.some(e => (options.overrides[e.id]?.target ?? e.target) > 0)
  return network.edges.filter(e => !options.overrides[e.id]?.closed).map(edge => {
    const resistance = options.overrides[edge.id]?.resistance ?? edge.resistance
    const perturbed = solveValidated(network, { ...options, overrides: {
      ...options.overrides, [edge.id]: { ...options.overrides[edge.id], resistance: resistance * 1.05 },
    } })
    if (!perturbed.converged) throw new Error(`Resistance sensitivity failed for ${edge.id}: ${perturbed.message ?? 'equations did not converge'}`)
    return {
      edgeId: edge.id,
      elasticity: hasTargets && Math.abs(baseline.targetRatio) > 1e-9 ? (perturbed.targetRatio - baseline.targetRatio) / Math.abs(baseline.targetRatio) / 0.05 : 0,
      powerDelta: perturbed.fanPowerKW - baseline.fanPowerKW,
      flowDelta: perturbed.totalIntake - baseline.totalIntake,
    }
  }).sort((a, b) => Math.abs(b.elasticity) - Math.abs(a.elasticity))
}

/** Twenty-one actual network solutions. Pressure is flow-weighted fan delivery (Pa). */
export function curve(input: Network, suppliedOptions: SolveOptions): CurvePoint[] {
  const network = validateNetwork(input), options = validateOptions(suppliedOptions, network)
  return Array.from({ length: 21 }, (_, i) => {
    const speed = i * LIMITS.maxSpeed / 20
    const result = solveValidated(network, { ...options, speed })
    if (!result.converged) throw new Error(`Speed curve failed at ${(100 * speed).toFixed(1)}%: ${result.message ?? 'equations did not converge'}`)
    let weightedPressure = 0, volume = 0
    network.edges.forEach((edge, j) => {
      if (!edge.fan || options.overrides[edge.id]?.closed || result.flows[j] <= 0) return
      const q = result.flows[j]
      weightedPressure += q * Math.max(0, edge.fan.pressure * speed * speed - edge.fan.coefficient * q * Math.abs(q))
      volume += q
    })
    return { speed, flow: result.totalIntake, power: result.fanPowerKW, pressure: volume > 0 ? weightedPressure / volume : 0, targetRatio: result.targetRatio }
  })
}
