/**
 * All numerical quantities use SI units unless the property explicitly says otherwise.
 *
 * The types below are the app's names for the documents and messages of the contract catalog. They are aliases of the
 * types generated from the schema files of docs/contracts/schemas/ (src/lib/contract.gen.ts, ADR-0080): the schema is
 * the single source, and the description of each quantity (units, bounds) is in the schema.
 */
import type * as T from "./lib/contract.types";

export type LocalizedText = T.LocalizedText;
export type NetworkNode = T.NetworkNode;
export type EdgeKind = T.EdgeKind;
export type Fan = T.Fan;
export type NetworkEdge = T.NetworkEdge;
export type Network = T.Network;
export type EdgeOverride = T.EdgeOverride;
export type SolveOptions = T.SolveOptions;
export type Options = SolveOptions;
export type Node = NetworkNode;
export type Edge = NetworkEdge;
/** One solve: the residual fields are the acceptance evidence; `message` appears when the acceptance fails. */
export type Result = T.Result;
export type OptimizationResult = T.OptimizationResult;
export type SensitivityPoint = T.SensitivityPoint;
export type CurvePoint = T.CurvePoint;
export type EngineKind = T.EngineKind;
export type EngineRequest = T.EngineRequest;
export type EngineResponse = T.EngineResponse;
/** The resistance-uncertainty ensemble the bake writes with a case (catalog.schema.json, $defs.ensemble). */
export type AnalysisEnsemble = T.CatalogEnsemble;
