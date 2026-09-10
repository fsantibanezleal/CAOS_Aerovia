import type { DomainCheck, ModelEntry, Network, Options } from './types';

/** Explicit calibration envelope. No clipping and no nonlinear solver fallback. */
export function checkDomain(network: Network, options: Options, entry: ModelEntry | undefined): DomainCheck {
  if (!entry) return { supported: false, code: 'unknown-topology', reason: 'No trained calibration exists for this network.' };
  const signature = entry.signature;
  if (network.nodes.length !== signature.nodeIds.length || network.edges.length !== signature.edgeIds.length)
    return { supported: false, code: 'changed-topology', reason: 'The node or airway count differs from the calibrated network.' };
  for (let i = 0; i < network.nodes.length; i++) {
    const node = network.nodes[i];
    if (node.id !== signature.nodeIds[i] || (node.boundary ?? null) !== signature.boundaries[i])
      return { supported: false, code: 'changed-boundary', reason: 'Node identity, order or pressure boundaries differ from the trained calibration.' };
  }
  for (let i = 0; i < network.edges.length; i++) {
    const edge = network.edges[i];
    if (edge.id !== signature.edgeIds[i] || edge.from !== signature.from[i] || edge.to !== signature.to[i] || edge.kind !== signature.kinds[i] ||
      (edge.fan?.pressure ?? 0) !== signature.fanPressure[i] || (edge.fan?.coefficient ?? 0) !== signature.fanCoefficient[i] || (edge.fan?.efficiency ?? 1) !== signature.fanEfficiency[i])
      return { supported: false, code: 'changed-topology', reason: 'Airway connectivity, identity, type or fan curve differs from the trained calibration.' };
    if (options.overrides[edge.id]?.closed)
      return { supported: false, code: 'closure', reason: 'Closing an airway changes the calibrated topology. Use the numerical solver.' };
  }
  if (!Number.isFinite(options.speed) || options.speed < entry.speedBounds[0] || options.speed > entry.speedBounds[1])
    return { supported: false, code: 'speed', reason: 'Fan speed is outside the validated homogeneous scaling range.' };
  const values = network.edges.map((edge, i) => (options.overrides[edge.id]?.resistance ?? edge.resistance) * options.resistanceScale / entry.baseResistances[i]);
  if (values.some(value => !Number.isFinite(value) || value < entry.factorBounds[0] || value > entry.factorBounds[1]))
    return { supported: false, code: 'resistance', reason: `Effective resistance ratios must be within ${entry.factorBounds[0]}–${entry.factorBounds[1]} of the trained base.` };
  return { supported: true, code: 'supported', reason: 'Known calibrated topology and bounded resistance ratios. Review approximation errors and physical residuals.', features: Float32Array.from(values, value => Math.log(value)) };
}
