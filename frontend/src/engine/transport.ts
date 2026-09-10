import type { Network, Result, SolveOptions } from "../contracts";
import { airwayLengths } from "./routing";
import { solveNetwork } from "./solver";
import { validateNetwork, validateOptions } from "./validation";

export const TRANSPORT_LIMITS = Object.freeze({
  cellsPerEdge: 16,
  frames: 301,
  releases: 32,
  changes: 24,
  durationSeconds: 86400,
  steps: 200000,
  cellSteps: 40000000,
  cfl: 0.45,
});
export interface FlowChange {
  timeSeconds: number;
  options: SolveOptions;
}
export interface FlowState extends FlowChange {
  result: Result;
}
interface ReleaseLocation {
  edgeId: string;
  position?: number;
  startSeconds: number;
}
export type TracerRelease = ReleaseLocation &
  (
    | { kind: "pulse"; massMg: number }
    | { kind: "continuous"; durationSeconds: number; rateMgPerSecond: number }
  );
export interface TransportOptions {
  durationSeconds: number;
  frameCount?: number;
  cellsPerEdge?: number;
  releases: TracerRelease[];
  schedule?: FlowChange[];
  edgeLengths?: Record<string, number>;
  decayPerSecond?: number;
  maxStepSeconds?: number;
}
export interface TransportFrame {
  timeSeconds: number;
  flowStateIndex: number;
  concentrations: number[];
  cellConcentrations: number[][];
  nodeConcentrations: number[];
  injectedMassMg: number;
  storedMassMg: number;
  escapedMassMg: number;
  removedMassMg: number;
  massBalanceErrorMg: number;
}
export interface TransportResult {
  schema: "aerovia.transport/v1";
  completed: boolean;
  frames: TransportFrame[];
  flowStates: FlowState[];
  edgeLengths: number[];
  edgeVolumes: number[];
  cellsPerEdge: number;
  steps: number;
  elapsedMs: number;
  warnings: string[];
  message?: string;
}

function bounded(value: unknown, at: string, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${at} must be finite and between ${min} and ${max}.`);
  return value;
}
function integer(value: unknown, at: string, min: number, max: number): number {
  const result = bounded(value, at, min, max);
  if (!Number.isInteger(result)) throw new Error(`${at} must be an integer.`);
  return result;
}

/** Complete, piecewise-constant options. Solves equilibrium, without fan inertia. */
export function solveFlowTimeline(
  input: Network,
  suppliedOptions: SolveOptions,
  schedule: FlowChange[] = [],
): FlowState[] {
  const network = validateNetwork(input);
  const base = validateOptions(suppliedOptions, network);
  if (!Array.isArray(schedule) || schedule.length > TRANSPORT_LIMITS.changes)
    throw new Error(
      `A flow timeline supports at most ${TRANSPORT_LIMITS.changes} changes.`,
    );
  const changes = schedule
    .map((change, i) => {
      if (!change || typeof change !== "object")
        throw new Error(`Flow change ${i + 1} must be an object.`);
      const timeSeconds = bounded(
        change.timeSeconds,
        `Flow change ${i + 1} time`,
        Number.MIN_VALUE,
        TRANSPORT_LIMITS.durationSeconds,
      );
      const options = validateOptions(change.options, network);
      for (const edge of network.edges) {
        if (
          (options.overrides[edge.id]?.area ?? edge.area) !==
          (base.overrides[edge.id]?.area ?? edge.area)
        )
          throw new Error(
            `Flow change ${i + 1} changes area in ${edge.id}. A transport timeline requires fixed airway volumes; compare separate runs for area changes.`,
          );
      }
      return { timeSeconds, options };
    })
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
  for (let i = 1; i < changes.length; i++)
    if (changes[i].timeSeconds === changes[i - 1].timeSeconds)
      throw new Error("Flow changes must have distinct times.");
  return [{ timeSeconds: 0, options: base }, ...changes].map((change) => ({
    ...change,
    result: solveNetwork(network, change.options),
  }));
}

interface PreparedFlow {
  upstream: Int32Array;
  downstream: Int32Array;
  firstCell: Int32Array;
  lastCell: Int32Array;
  direction: Int8Array;
  magnitude: Float64Array;
  outward: Float64Array;
  stableStep: number;
}

/** Conservative airway-cell transport; see docs/methods/transport.md. */
export function simulateTransport(
  input: Network,
  suppliedOptions: SolveOptions,
  request: TransportOptions,
): TransportResult {
  const started = performance.now();
  const network = validateNetwork(input);
  const options = validateOptions(suppliedOptions, network);
  if (!request || typeof request !== "object")
    throw new Error("Transport settings must be an object.");
  const duration = bounded(
    request.durationSeconds,
    "Transport duration in seconds",
    1e-6,
    TRANSPORT_LIMITS.durationSeconds,
  );
  const frameCount = integer(
    request.frameCount ?? 121,
    "Frame count",
    2,
    TRANSPORT_LIMITS.frames,
  );
  const cells = integer(
    request.cellsPerEdge ?? 6,
    "Cells per airway",
    1,
    TRANSPORT_LIMITS.cellsPerEdge,
  );
  const decay = bounded(
    request.decayPerSecond ?? 0,
    "First-order loss per second",
    0,
    100,
  );
  const maxStep =
    request.maxStepSeconds === undefined
      ? Infinity
      : bounded(
          request.maxStepSeconds,
          "Maximum time step",
          1e-8,
          TRANSPORT_LIMITS.durationSeconds,
        );
  const lengths = airwayLengths(network, request.edgeLengths);
  const volumes = network.edges.map(
    (edge, i) => lengths[i] * (options.overrides[edge.id]?.area ?? edge.area),
  );
  const cellVolumes = volumes.map((volume) => volume / cells);
  const edgeIndex = new Map(network.edges.map((edge, i) => [edge.id, i]));
  if (
    !Array.isArray(request.releases) ||
    request.releases.length > TRANSPORT_LIMITS.releases
  )
    throw new Error(
      `Specify at most ${TRANSPORT_LIMITS.releases} tracer releases.`,
    );
  const releases = request.releases.map((release, i) => {
    if (
      !release ||
      typeof release !== "object" ||
      !edgeIndex.has(release.edgeId)
    )
      throw new Error(`Release ${i + 1} must select an existing airway.`);
    const edge = edgeIndex.get(release.edgeId)!;
    const position = bounded(
      release.position ?? 0.5,
      `Release ${i + 1} position`,
      0,
      1,
    );
    const start = bounded(
      release.startSeconds,
      `Release ${i + 1} start`,
      0,
      duration,
    );
    const scaled = position * cells;
    const interfaceIndex = Math.round(scaled);
    // Equal split at a cell interface keeps source placement invariant when an
    // airway and its position coordinate are reversed.
    const locations =
      interfaceIndex > 0 &&
      interfaceIndex < cells &&
      Math.abs(scaled - interfaceIndex) < 1e-12
        ? [
            { cell: edge * cells + interfaceIndex - 1, fraction: 0.5 },
            { cell: edge * cells + interfaceIndex, fraction: 0.5 },
          ]
        : [
            {
              cell: edge * cells + Math.min(cells - 1, Math.floor(scaled)),
              fraction: 1,
            },
          ];
    if (release.kind === "pulse")
      return {
        locations,
        start,
        end: start,
        pulse: bounded(release.massMg, `Release ${i + 1} pulse mass`, 0, 1e12),
        rate: 0,
      };
    if (release.kind !== "continuous")
      throw new Error(`Release ${i + 1} must be pulse or continuous.`);
    const releaseDuration = bounded(
      release.durationSeconds,
      `Release ${i + 1} duration`,
      1e-8,
      duration,
    );
    if (start + releaseDuration > duration + 1e-10 * duration)
      throw new Error(
        `Release ${i + 1} ends after the simulation. Extend the simulation or shorten the release.`,
      );
    return {
      locations,
      start,
      end: Math.min(duration, start + releaseDuration),
      pulse: 0,
      rate: bounded(release.rateMgPerSecond, `Release ${i + 1} rate`, 0, 1e12),
    };
  });
  const flowStates = solveFlowTimeline(network, options, request.schedule);
  if (flowStates.some((state) => state.timeSeconds > duration))
    throw new Error("A flow change occurs after the simulation ends.");
  const result: TransportResult = {
    schema: "aerovia.transport/v1",
    completed: false,
    frames: [],
    flowStates,
    edgeLengths: lengths,
    edgeVolumes: volumes,
    cellsPerEdge: cells,
    steps: 0,
    elapsedMs: 0,
    warnings: [
      "Passive tracer with well-mixed airway cells; cell count controls numerical dispersion. This is not CFD or a field-calibrated exposure model.",
      "Lengths use node geometry unless explicitly overridden. Pressure boundaries are clean external reservoirs.",
      ...(flowStates.length > 1
        ? [
            "Flow changes are instantaneous quasi-steady network equilibria; fan inertia and pressure transients are not modelled.",
          ]
        : []),
    ],
  };
  const failed = flowStates.find((state) => !state.result.converged);
  if (failed)
    return {
      ...result,
      elapsedMs: performance.now() - started,
      message: `Unsupported airflow at ${failed.timeSeconds} s: ${failed.result.message ?? "the network did not converge"}`,
    };

  const nodeIndex = new Map(network.nodes.map((node, i) => [node.id, i]));
  const boundary = network.nodes.map((node) => node.boundary !== undefined);
  const prepared: PreparedFlow[] = flowStates.map((state) => {
    const upstream = new Int32Array(network.edges.length);
    const downstream = new Int32Array(network.edges.length);
    const firstCell = new Int32Array(network.edges.length);
    const lastCell = new Int32Array(network.edges.length);
    const direction = new Int8Array(network.edges.length);
    const magnitude = new Float64Array(network.edges.length);
    const outward = new Float64Array(network.nodes.length);
    const inward = new Float64Array(network.nodes.length);
    let maxRemoval = decay;
    network.edges.forEach((edge, e) => {
      const forward = state.result.flows[e] >= 0;
      upstream[e] = nodeIndex.get(forward ? edge.from : edge.to)!;
      downstream[e] = nodeIndex.get(forward ? edge.to : edge.from)!;
      firstCell[e] = e * cells + (forward ? 0 : cells - 1);
      lastCell[e] = e * cells + (forward ? cells - 1 : 0);
      direction[e] = forward ? 1 : -1;
      magnitude[e] = Math.abs(state.result.flows[e]);
      outward[upstream[e]] += magnitude[e];
      inward[downstream[e]] += magnitude[e];
      maxRemoval = Math.max(maxRemoval, magnitude[e] / cellVolumes[e] + decay);
    });
    network.nodes.forEach((node, i) => {
      if (!boundary[i] && inward[i] > 0 && outward[i] === 0)
        throw new Error(
          `Junction ${node.id} has incoming airflow but no outgoing path. Transport cannot conserve mass through this airflow state.`,
        );
    });
    return {
      upstream,
      downstream,
      firstCell,
      lastCell,
      direction,
      magnitude,
      outward,
      stableStep: Math.min(
        maxStep,
        maxRemoval > 0 ? TRANSPORT_LIMITS.cfl / maxRemoval : Infinity,
      ),
    };
  });
  const frameTimes = Array.from({ length: frameCount }, (_, i) =>
    i === frameCount - 1 ? duration : (i * duration) / (frameCount - 1),
  );
  const frameSet = new Set(frameTimes);
  const events = [
    ...new Set([
      ...frameTimes,
      ...flowStates.map((state) => state.timeSeconds),
      ...releases.flatMap((release) => [release.start, release.end]),
    ]),
  ].sort((a, b) => a - b);
  // Admit the exact segmented workload before allocating frames or advancing mass.
  let predictedSteps = 0;
  let predictedState = 0;
  for (let i = 1; i < events.length; i++) {
    while (
      predictedState + 1 < flowStates.length &&
      flowStates[predictedState + 1].timeSeconds <= events[i - 1]
    )
      predictedState++;
    predictedSteps += Math.max(
      1,
      Math.ceil(
        (events[i] - events[i - 1]) / prepared[predictedState].stableStep,
      ),
    );
  }
  if (
    predictedSteps > TRANSPORT_LIMITS.steps ||
    predictedSteps * cells * network.edges.length > TRANSPORT_LIMITS.cellSteps
  )
    throw new Error(
      "Transport exceeds the browser integration budget. Shorten duration, reduce cells per airway, or use realistic positive airway lengths; inputs were not silently coarsened.",
    );

  const count = cells * network.edges.length;
  const mass = new Float64Array(count);
  const stage = new Float64Array(count);
  const d1 = new Float64Array(count);
  const d2 = new Float64Array(count);
  const sources = new Float64Array(count);
  const nodeFlux = new Float64Array(network.nodes.length);
  let injected = 0;
  let escaped = 0;
  let removed = 0;
  let stateIndex = 0;

  // Returns rates for ledger quadrature; internal transfers cancel pairwise.
  const derivative = (
    state: Float64Array,
    output: Float64Array,
    flow: PreparedFlow,
  ): [number, number] => {
    output.set(sources);
    nodeFlux.fill(0);
    let escapedRate = 0;
    let removedRate = 0;
    for (let e = 0; e < network.edges.length; e++) {
      const q = flow.magnitude[e];
      let cell = flow.firstCell[e];
      for (let j = 0; j < cells; j++, cell += flow.direction[e]) {
        const flux = (q * state[cell]) / cellVolumes[e];
        const sink = decay * state[cell];
        output[cell] -= flux + sink;
        removedRate += sink;
        if (j + 1 < cells) output[cell + flow.direction[e]] += flux;
        else if (boundary[flow.downstream[e]]) escapedRate += flux;
        else nodeFlux[flow.downstream[e]] += flux;
      }
    }
    for (let e = 0; e < network.edges.length; e++) {
      const u = flow.upstream[e];
      if (!boundary[u] && flow.outward[u] > 0)
        output[flow.firstCell[e]] +=
          (nodeFlux[u] * flow.magnitude[e]) / flow.outward[u];
    }
    return [escapedRate, removedRate];
  };
  const snapshot = (timeSeconds: number): void => {
    const flow = prepared[stateIndex];
    const concentrations: number[] = [];
    const cellConcentrations: number[][] = [];
    const nodeConcentrations = network.nodes.map(() => 0);
    let stored = 0;
    network.edges.forEach((_, e) => {
      const edgeCells = Array.from(
        mass.subarray(e * cells, (e + 1) * cells),
        (value) => value / cellVolumes[e],
      );
      const edgeMass = edgeCells.reduce(
        (sum, c) => sum + c * cellVolumes[e],
        0,
      );
      concentrations.push(edgeMass / volumes[e]);
      cellConcentrations.push(edgeCells);
      stored += edgeMass;
      const v = flow.downstream[e];
      if (!boundary[v] && flow.outward[v] > 0)
        nodeConcentrations[v] +=
          (flow.magnitude[e] * mass[flow.lastCell[e]]) /
          cellVolumes[e] /
          flow.outward[v];
    });
    result.frames.push({
      timeSeconds,
      flowStateIndex: stateIndex,
      concentrations,
      cellConcentrations,
      nodeConcentrations,
      injectedMassMg: injected,
      storedMassMg: stored,
      escapedMassMg: escaped,
      removedMassMg: removed,
      massBalanceErrorMg: injected - stored - escaped - removed,
    });
  };
  let time = 0;
  for (const event of events) {
    if (event > time) {
      sources.fill(0);
      let sourceRate = 0;
      for (const release of releases)
        if (release.start <= time && release.end > time) {
          for (const location of release.locations)
            sources[location.cell] += release.rate * location.fraction;
          sourceRate += release.rate;
        }
      const flow = prepared[stateIndex];
      const steps = Math.max(1, Math.ceil((event - time) / flow.stableStep));
      const dt = (event - time) / steps;
      for (let step = 0; step < steps; step++) {
        const [escape1, remove1] = derivative(mass, d1, flow);
        for (let i = 0; i < count; i++) stage[i] = mass[i] + dt * d1[i];
        const [escape2, remove2] = derivative(stage, d2, flow);
        for (let i = 0; i < count; i++)
          mass[i] = 0.5 * mass[i] + 0.5 * (stage[i] + dt * d2[i]);
        injected += dt * sourceRate;
        escaped += dt * 0.5 * (escape1 + escape2);
        removed += dt * 0.5 * (remove1 + remove2);
      }
      result.steps += steps;
      time = event;
    }
    while (
      stateIndex + 1 < flowStates.length &&
      flowStates[stateIndex + 1].timeSeconds <= event
    )
      stateIndex++;
    for (const release of releases)
      if (release.start === event && release.pulse > 0) {
        for (const location of release.locations)
          mass[location.cell] += release.pulse * location.fraction;
        injected += release.pulse;
      }
    if (frameSet.has(event)) snapshot(event);
  }
  result.completed = true;
  result.elapsedMs = performance.now() - started;
  return result;
}
