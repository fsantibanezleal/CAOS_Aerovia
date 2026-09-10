import type { InferenceSession } from 'onnxruntime-web/wasm';
import { MASS_TOLERANCE, PRESSURE_TOLERANCE, validateNetwork, validateOptions } from '../engine';
import { checkDomain } from './domain';
import type { LearnedMethod, ModelRegistry, ModelEntry, Network, Options, Prediction, Result, ScienceArtifact, SurrogateResponse } from './types';
export * from './types';
export { checkDomain } from './domain';

const base = import.meta.env.BASE_URL;
let registryPromise: Promise<ModelRegistry> | undefined;
let sciencePromise: Promise<ScienceArtifact> | undefined;
const sessions = new Map<string, Promise<InferenceSession>>();
const assetUrl = (relative: string) => new URL(`${base}data/${relative}`, globalThis.location.href).href;

async function readJson<T>(relative: string, schema: string): Promise<T> {
  const response = await fetch(assetUrl(relative));
  if (!response.ok) throw new Error(`Scientific asset unavailable (${response.status}).`);
  const value = await response.json();
  if (value?.schema !== schema) throw new Error('Scientific asset schema does not match this release.');
  return value as T;
}

export function loadRegistry(): Promise<ModelRegistry> {
  return registryPromise ??= readJson<ModelRegistry>('models/registry.json', 'aerovia.model-registry/v1').catch(error => { registryPromise = undefined; throw error; });
}
export function loadScience(): Promise<ScienceArtifact> {
  return sciencePromise ??= readJson<ScienceArtifact>('science.json', 'aerovia.science/v1').catch(error => { sciencePromise = undefined; throw error; });
}

async function getSession(entry: ModelEntry): Promise<InferenceSession> {
  const key = `${entry.methodId}:${entry.networkId}:${entry.onnx.sha256}`;
  let pending = sessions.get(key);
  if (!pending) {
    pending = (async () => {
      if (!/^[a-z0-9/-]+\.onnx$/.test(entry.onnx.file) || entry.onnx.file.includes('..') || entry.onnx.bytes > 20_000_000)
        throw new Error('The registered model path or size is invalid.');
      const response = await fetch(assetUrl(`models/${entry.onnx.file}`));
      if (!response.ok) throw new Error(`Model unavailable (${response.status}).`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== entry.onnx.bytes) throw new Error('Model byte count differs from the audited registry.');
      const actualHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
      if (actualHash !== entry.onnx.sha256) throw new Error('Model checksum differs from the audited registry.');
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = assetUrl('ort/');
      return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    })().catch(error => { sessions.delete(key); throw error; });
    sessions.set(key, pending);
  }
  return pending;
}

/** Derived scalars/residuals only. This function does not solve or adjust flows. */
export function resultFromArrays(network: Network, options: Options, flows: number[], pressures: number[], elapsedMs: number): Result {
  if (flows.length !== network.edges.length || pressures.length !== network.nodes.length || [...flows, ...pressures].some(value => !Number.isFinite(value)))
    throw new Error('Learned output has invalid dimensions or nonfinite values.');
  const ids = new Map(network.nodes.map((node, i) => [node.id, i]));
  const balance = network.nodes.map(() => 0);
  let pressureResidual = 0, fanPowerKW = 0, unsupportedFan = false;
  const velocities: number[] = [], shortfalls: number[] = [], ratios: number[] = [];
  network.edges.forEach((edge, i) => {
    const q = flows[i], from = ids.get(edge.from)!, to = ids.get(edge.to)!;
    const edited = options.overrides[edge.id];
    const r = (edited?.resistance ?? edge.resistance) * options.resistanceScale;
    const h = (edge.fan?.pressure ?? 0) * options.speed ** 2;
    const k = edge.fan?.coefficient ?? 0;
    balance[from] += q; balance[to] -= q;
    pressureResidual = Math.max(pressureResidual, Math.abs(pressures[from] - pressures[to] + h - (r + k) * q * Math.abs(q)));
    if (edge.fan) {
      const delivered = h - k * q * Math.abs(q);
      unsupportedFan ||= q < -1e-7 || delivered < -1e-6;
      fanPowerKW += Math.max(delivered, 0) * Math.max(q, 0) / edge.fan.efficiency / 1000;
    }
    const target = edited?.target ?? edge.target;
    velocities.push(q / (edited?.area ?? edge.area));
    shortfalls.push(Math.max(0, target - q));
    if (target > 0) ratios.push(q / target);
  });
  const massResidual = Math.max(0, ...balance.filter((_, i) => network.nodes[i].boundary === undefined).map(Math.abs));
  const boundaryResidual = Math.max(0, ...network.nodes.map((node, i) => node.boundary === undefined ? 0 : Math.abs(pressures[i] - node.boundary)));
  pressureResidual = Math.max(pressureResidual, boundaryResidual);
  const converged = massResidual <= MASS_TOLERANCE && pressureResidual <= PRESSURE_TOLERANCE && !unsupportedFan;
  return { schema: 'aerovia.result/v1', converged, iterations: 0, massResidual, pressureResidual, flows, pressures, velocities, shortfalls,
    fanPowerKW, totalIntake: balance.reduce((sum, value, i) => sum + (network.nodes[i].boundary === undefined ? 0 : Math.max(0, value)), 0),
    targetRatio: ratios.length ? Math.min(...ratios) : 1, elapsedMs,
    message: unsupportedFan ? 'Learned approximation predicts unsupported fan delivery; inspect the numerical reference.' : 'Learned approximation. Physical residual acceptance is reported separately from model execution.' };
}

function metrics(predicted: Result, reference: Result): Prediction['metrics'] {
  const q = predicted.flows.map((value, i) => value - reference.flows[i]);
  const p = predicted.pressures.map((value, i) => value - reference.pressures[i]);
  return { flowMAE: q.reduce((sum, value) => sum + Math.abs(value), 0) / q.length,
    flowRMSE: Math.sqrt(q.reduce((sum, value) => sum + value * value, 0) / q.length), flowMaxError: Math.max(...q.map(Math.abs)),
    pressureMAE: p.reduce((sum, value) => sum + Math.abs(value), 0) / p.length, pressureMaxError: Math.max(...p.map(Math.abs)),
    powerAbsErrorKW: Math.abs(predicted.fanPowerKW - reference.fanPowerKW) };
}

export async function predictSurrogate(network: Network, supplied: Options, methodId: LearnedMethod, reference: Result): Promise<SurrogateResponse> {
  const started = performance.now();
  try {
    validateNetwork(network);
    const options = validateOptions(supplied, network);
    const registry = await loadRegistry();
    const entry = registry.entries.find(item => item.networkId === network.id && item.methodId === methodId);
    const domain = checkDomain(network, options, entry);
    if (!domain.supported || !entry || !domain.features) return { status: 'out-of-domain', reason: domain.reason, methodId, diagnostics: {} };
    if (!reference || reference.flows.length !== network.edges.length || reference.pressures.length !== network.nodes.length || !reference.converged)
      throw new Error('A converged numerical reference for the identical inputs is required for an error comparison.');
    const checkedReference = resultFromArrays(network, options, reference.flows, reference.pressures, 0);
    if (!checkedReference.converged) throw new Error('The supplied reference belongs to different inputs; wait for the current numerical solution.');
    const session = await getSession(entry);
    const { Tensor } = await import('onnxruntime-web/wasm');
    const inferenceStarted = performance.now();
    const output = await session.run({ logResistanceRatios: new Tensor('float32', domain.features, [1, network.edges.length]) });
    const inferenceMs = performance.now() - inferenceStarted;
    const raw = Array.from(output.rawFlows.data as Float32Array, value => value * options.speed);
    const q = Array.from(output.flows.data as Float32Array, value => value * options.speed);
    const p = Array.from(output.pressures.data as Float32Array, value => value * options.speed ** 2);
    const result = resultFromArrays(network, options, q, p, inferenceMs);
    if (raw.length !== q.length || raw.some(value => !Number.isFinite(value))) throw new Error('Invalid raw model output.');
    const prediction: Prediction = { status: 'supported', lane: 'live-wasm', modelVersion: entry.version, rawFlows: raw, result,
      errors: q.map((value, i) => value - checkedReference.flows[i]), metrics: metrics(result, checkedReference) };
    return { status: 'supported', reason: domain.reason, methodId, modelVersion: entry.version, prediction,
      diagnostics: { inferenceMs, totalMs: performance.now() - started, modelBytes: entry.onnx.bytes, backend: 'ONNX Runtime Web / WASM CPU / one thread' } };
  } catch (error) {
    return { status: error instanceof TypeError ? 'unavailable' : 'failed', reason: error instanceof Error ? error.message : 'Learned model inference failed.', methodId, diagnostics: { totalMs: performance.now() - started } };
  }
}
