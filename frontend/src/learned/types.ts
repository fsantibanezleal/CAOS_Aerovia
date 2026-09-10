import type { Network, Options, Result } from '../contracts';

export type LearnedMethod = 'topology-mlp' | 'graph-surrogate';
export type Localized = { en: string; es: string };
export interface PhysicalSignature {
  nodeIds: string[]; boundaries: (number | null)[]; edgeIds: string[]; from: string[]; to: string[]; kinds: string[];
  fanPressure: number[]; fanCoefficient: number[]; fanEfficiency: number[];
}
export interface ModelEntry {
  methodId: LearnedMethod; networkId: string; version: string; license: string; status: string;
  onnx: { file: string; sha256: string; bytes: number };
  checkpoint: { file: string; sha256: string; bytes: number };
  factorBounds: [number, number]; speedBounds: [number, number]; baseResistances: number[]; signature: PhysicalSignature;
  input: { name: string; dtype: string; shape: [string, number] }; outputs: string[]; outputSpeed: number;
  onnxParity: { samples: number; flowMaxAbs: number; pressureMaxAbs: number; flowTolerance: number; pressureTolerance: number };
  trainingCaseIds: string[]; bestEpoch: number; validationLoss: number;
}
export interface ModelRegistry { schema: 'aerovia.model-registry/v1'; version: string; sourceSha256: string; entries: ModelEntry[] }
export interface PredictionMetrics {
  flowMAE: number; flowRMSE: number; flowMaxError: number; pressureMAE: number; pressureMaxError: number; powerAbsErrorKW: number;
}
export interface Prediction {
  status: 'supported'; lane: string; modelVersion: string; rawFlows: number[]; result: Result; errors: number[]; metrics: PredictionMetrics;
}
export interface BenchmarkRow {
  methodId: string; networkId?: string; regimeId?: string; split?: string; samples: number; cells?: number;
  flowMAE: number; flowRMSE: number; flowMaxError: number; flowNormalizedRMSE: number;
  rawFlowMAE?: number; rawFlowRMSE?: number; pressureMAE: number; pressureMaxError: number;
  massResidualMax: number; pressureResidualMax: number; powerMAE: number;
  shortfallTruePositive: number; shortfallFalseNegative: number; adequateTrueNegative: number; adequateFalsePositive: number;
  shortfallRecall: number | null; adequateRecall: number | null; classificationObservations: number;
  unsupportedFanPredictions: number; nonfinitePredictions: number; inferenceMs?: number; msPerSample?: number;
  timingScope?: string; runtime?: { device?: string; precision?: string; hardware?: string; threads?: number };
}
export interface CalibrationEvidence {
  methodId: LearnedMethod; networkId: string; samples: number; nominalCoverage: number;
  flowMaxErrorBoundUnitSpeed: number; pressureMaxErrorBoundUnitSpeed: number;
  heldoutCovered: number; heldoutSamples: number; heldoutCoverage: number; interpretation: string;
}
export interface ScienceArtifact {
  schema: 'aerovia.science/v1'; version: string; createdAt: string; sourceSha256: string;
  methods: { id: string; name: Localized; lane: string; status: string; modelVersion: string }[];
  regimes: { id: string; name: Localized; description: Localized; speed: number }[];
  cases: { networkId: string; sourceSha256: string; regimes: { id: string; options: Options; reference: Result; predictions: Record<LearnedMethod, Prediction> }[] }[];
  heldoutFixtures: { networkId: string; options: Options; reference: Result; split: 'test'; sampleId: string; sampleIndex: number }[];
  benchmark: { rows: BenchmarkRow[]; aggregate: BenchmarkRow[]; calibration: CalibrationEvidence[];
    teacherParity: { networkId: string; samples: number; flowMaxAbs: number; pressureMaxAbs: number }[];
    completeness: { cases: number; regimes: number; methods: number; expectedCells: number; actualCells: number; missingCells: number };
    splitScope: string; metricUnits: Record<string, string>;
    degradation?: { noiseSigma: number; methodId: LearnedMethod; samples: number; flowMAE: number; flowRMSE: number; pressureMAE: number; outsideDomain: number }[];
    familyHoldout?: { family: string; excludedCaseIds: string[]; trainingCaseIds: string[]; metrics: BenchmarkRow[]; aggregate: BenchmarkRow; interpretation: string;
      training: { epochs: number; bestEpoch: number; bestValidationLoss: number; elapsedSeconds: number; parameters: number; seed: number; checkpoint: string; sha256: string; runtime: { device: string; hardware: string; torch: string } };
      nominalCalibration: string; mlpStatus: string };
  };
  training: { totalSamples: number; splits: Record<string, number>; uniqueInputVectors: number; duplicateInputs: number; datasetSeconds: number;
    models: { methodId: string; caseIds: string[]; epochs: number; bestEpoch: number; parameters: number; elapsedSeconds: number; runtime: { device: string; hardware: string; torch: string }; architecture: { hidden: number; steps: number } }[] };
  validation: { controls: { networkId: string; id: string; status: string; reason: string }[]; onnx: unknown[]; browserParity: string };
  provenance: { dataKind: string; noFieldMeasurements: boolean; license: string; calibration: string; sources: string[] };
}
export interface SurrogateResponse {
  status: 'supported' | 'out-of-domain' | 'unavailable' | 'failed'; reason: string;
  methodId: LearnedMethod; modelVersion?: string; prediction?: Prediction;
  diagnostics: { inferenceMs?: number; totalMs?: number; modelBytes?: number; backend?: string; calibration?: CalibrationEvidence };
}
export interface DomainCheck { supported: boolean; reason: string; code: string; features?: Float32Array }
export type { Network, Options, Result };
