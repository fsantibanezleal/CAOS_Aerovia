/** All numerical quantities use SI units unless the property explicitly says otherwise. */
export interface LocalizedText { en: string; es: string }
export interface NetworkNode { id: string; x: number; y: number; z: number; boundary?: number }
export type EdgeKind = 'intake' | 'return' | 'working' | 'crosscut' | 'fan'
export interface Fan { pressure: number; coefficient: number; efficiency: number }
export interface NetworkEdge {
  id: string
  from: string
  to: string
  name: LocalizedText
  kind: EdgeKind
  area: number
  resistance: number
  target: number
  level: number
  fan?: Fan
}
export interface Network {
  schema: 'aerovia.network/v1'
  id: string
  name: LocalizedText
  description: LocalizedText
  provenance: { kind: 'authored' | 'imported'; source: string; license: string }
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}
export interface EdgeOverride { resistance?: number; area?: number; target?: number; closed?: boolean }
export interface SolveOptions {
  speed: number
  resistanceScale: number
  overrides: Record<string, EdgeOverride>
}
export type Options = SolveOptions
export type Node = NetworkNode
export type Edge = NetworkEdge
export interface Result {
  schema: 'aerovia.result/v1'
  converged: boolean
  iterations: number
  /** Maximum absolute imbalance at an internal junction, m³/s. */
  massResidual: number
  /** Maximum absolute signed branch equation error, Pa. Closed branches are excluded. */
  pressureResidual: number
  flows: number[]
  pressures: number[]
  velocities: number[]
  fanPowerKW: number
  totalIntake: number
  /** Minimum signed Q / target across positive targets; 1 when no targets are set. */
  targetRatio: number
  shortfalls: number[]
  elapsedMs: number
  message?: string
}
export interface OptimizationResult { feasible: boolean; speed: number; result: Result; evaluations: number }
export interface SensitivityPoint { edgeId: string; elasticity: number; powerDelta: number; flowDelta: number }
export interface CurvePoint { speed: number; flow: number; power: number; pressure: number; targetRatio: number }
export type EngineKind = 'solve' | 'optimize' | 'sensitivity' | 'curve'
export interface EngineRequest { id: number | string; kind: EngineKind; network: Network; options: SolveOptions }
export interface EngineResponse {
  id: number | string
  kind: EngineKind
  result?: Result | OptimizationResult | SensitivityPoint[] | CurvePoint[]
  error?: string
}
