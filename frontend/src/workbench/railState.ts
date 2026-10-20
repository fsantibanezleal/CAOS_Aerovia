import type { Network, Options } from "../contracts";

/** A short deterministic signature of a design (FNV-1a over its JSON): an edit of any node or airway changes it. */
export function designSignature(network: Network): string {
  const text = JSON.stringify([network.nodes, network.edges]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${network.nodes.length}.${network.edges.length}.${h.toString(16)}`;
}

/**
 * Every value that changes the solve, for the shell's selection key (S10): the operating point of the rail (fan speed,
 * resistance scale, per-airway overrides) and the design itself. With the case it forms the key every view and readout
 * is checked against.
 */
export function stateControls(network: Network, options: Options) {
  return {
    speed: options.speed,
    resistance: options.resistanceScale,
    overrides: options.overrides,
    design: designSignature(network),
  };
}
