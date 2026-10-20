import type { Network, Options, Result } from '../contracts';
import type * as T from '../lib/contract.types';

// The documents of the learned models are the types generated from the schema files (ADR-0080): the registry
// (model-registry.schema.json) and the scientific evidence (science.schema.json). The names the code has always used
// are aliases; only the messages of the in-browser run (SurrogateResponse, DomainCheck) are the app's own.
export type LearnedMethod = T.ModelEntry['methodId'];
export type Localized = T.Text;
export type ModelEntry = T.ModelEntry;
export type PhysicalSignature = ModelEntry['signature'];
export type ModelRegistry = T.ModelRegistry;
type DocumentPrediction = T.Schemas['prediction'];
/**
 * The prediction of a method. The committed document (science.schema.json) carries the lane `offline` and an
 * interpretation of the errors; the in-browser run (predictSurrogate) answers with the same shape on the lane
 * `live-wasm` and writes no interpretation, so the document's two differences are widened here and nowhere else.
 */
export type Prediction = Omit<DocumentPrediction, 'lane' | 'interpretation'> & { lane: DocumentPrediction['lane'] | 'live-wasm'; interpretation?: string };
export type PredictionMetrics = Prediction['metrics'];
export type ScienceArtifact = T.Science;
type Evaluation = ScienceArtifact['benchmark'];
type TableRow = Evaluation['rows'][number];
type AggregateRow = Evaluation['aggregate'][number];
type Shared = Exclude<keyof TableRow & keyof AggregateRow, 'methodId'>;
/**
 * A row of the metrics table, whichever section of the evidence it comes from: a held-out row (a network, a regime and
 * a split), the aggregate of a method (cells and timing) or a row of the family hold-out (its own method id and split).
 * The keys are the schema's; a key only some sections carry is optional.
 */
export type BenchmarkRow = { [K in Shared]: TableRow[K] | AggregateRow[K] } & Partial<Omit<TableRow, Shared | 'methodId' | 'split'>> &
  Partial<Omit<AggregateRow, Shared | 'methodId'>> & { methodId: string; split?: string };
export type CalibrationEvidence = Evaluation['calibration'][number];
export interface SurrogateResponse {
  status: 'supported' | 'out-of-domain' | 'unavailable' | 'failed'; reason: string;
  methodId: LearnedMethod; modelVersion?: string; prediction?: Prediction;
  diagnostics: { inferenceMs?: number; totalMs?: number; modelBytes?: number; backend?: string; calibration?: CalibrationEvidence };
}
export interface DomainCheck { supported: boolean; reason: string; code: string; features?: Float32Array }
export type { Network, Options, Result };
