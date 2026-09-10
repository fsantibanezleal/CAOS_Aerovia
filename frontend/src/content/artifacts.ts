import { useEffect, useState } from "react";
import type { Network, Result, SolveOptions } from "../contracts";
import { readBenchmark } from "../components/VerificationSummary";
import { validateNetwork, validateOptions } from "../engine/validation";

export interface CaseArtifact {
  network: Network;
  options: SolveOptions;
  result: Result;
  sourceSha256: string;
  optionsSha256: string;
  ensemble: {
    samples: number;
    acceptedSamples: number;
    seed: number;
    cv: number;
    device: string;
    flowP05: number[];
    flowP50: number[];
    flowP95: number[];
    targetProbability: number[];
    failures: number;
    failedSampleIndices: number[];
    [key: string]: unknown;
  };
}
export interface CatalogArtifact {
  schema: "aerovia.catalog/v1";
  createdAt: string;
  sourceSha256: string;
  cases: CaseArtifact[];
  benchmark: NonNullable<ReturnType<typeof readBenchmark>>;
}
type LoadState<T> = { loading: boolean; data: T | null; error: string | null };
const catalogCache: { promise?: Promise<CatalogArtifact> } = {};
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function arrayOfNumbers(value: unknown, count: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === count &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}
export function validateCatalog(value: unknown): CatalogArtifact {
  if (
    !isRecord(value) ||
    value.schema !== "aerovia.catalog/v1" ||
    !Array.isArray(value.cases) ||
    value.cases.length < 1 ||
    typeof value.createdAt !== "string" ||
    typeof value.sourceSha256 !== "string"
  )
    throw new Error("Invalid scientific catalog structure.");
  const cases = value.cases.map((row: unknown) => {
    if (!isRecord(row)) throw new Error("Invalid scientific case.");
    const network = validateNetwork(row.network);
    validateOptions(row.options, network);
    const r = row.result;
    if (
      !isRecord(r) ||
      r.schema !== "aerovia.result/v1" ||
      r.converged !== true ||
      !arrayOfNumbers(r.flows, network.edges.length) ||
      !arrayOfNumbers(r.pressures, network.nodes.length) ||
      !arrayOfNumbers(r.velocities, network.edges.length)
    )
      throw new Error("Missing accepted reference arrays.");
    for (const field of [
      "massResidual",
      "pressureResidual",
      "fanPowerKW",
      "totalIntake",
      "targetRatio",
      "elapsedMs",
    ])
      if (typeof r[field] !== "number" || !Number.isFinite(r[field]))
        throw new Error("Invalid reference metric.");
    const e = row.ensemble;
    if (
      !isRecord(e) ||
      !arrayOfNumbers(e.flowP05, network.edges.length) ||
      !arrayOfNumbers(e.flowP50, network.edges.length) ||
      !arrayOfNumbers(e.flowP95, network.edges.length) ||
      !arrayOfNumbers(e.targetProbability, network.edges.length) ||
      typeof e.samples !== "number" ||
      !Number.isSafeInteger(e.samples) ||
      e.samples < 1
    )
      throw new Error("Invalid ensemble evidence.");
    if (
      typeof e.acceptedSamples !== "number" ||
      !Number.isSafeInteger(e.acceptedSamples) ||
      e.acceptedSamples < 1 ||
      typeof e.failures !== "number" ||
      !Number.isSafeInteger(e.failures) ||
      e.failures < 0 ||
      e.acceptedSamples + e.failures !== e.samples ||
      !arrayOfNumbers(e.failedSampleIndices, e.failures) ||
      typeof e.seed !== "number" ||
      !Number.isSafeInteger(e.seed) ||
      typeof e.cv !== "number" ||
      !Number.isFinite(e.cv) ||
      e.cv < 0 ||
      typeof e.device !== "string"
    )
      throw new Error("Invalid ensemble accounting.");
    if (
      e.targetProbability.some((p) => p < 0 || p > 1) ||
      e.failedSampleIndices.some(
        (i) => !Number.isSafeInteger(i) || i < 0 || i >= (e.samples as number),
      ) ||
      new Set(e.failedSampleIndices).size !== e.failures ||
      e.flowP05.some(
        (p, i) =>
          p > (e.flowP50 as number[])[i] ||
          (e.flowP50 as number[])[i] > (e.flowP95 as number[])[i],
      )
    )
      throw new Error("Invalid ensemble probabilities or quantiles.");
    return row as unknown as CaseArtifact;
  });
  const benchmark = readBenchmark(value.benchmark, cases.length);
  if (!benchmark)
    throw new Error("Catalog benchmark does not match its cases.");
  return { ...value, cases, benchmark } as CatalogArtifact;
}
export function useCatalog(): LoadState<CatalogArtifact> {
  const [state, setState] = useState<LoadState<CatalogArtifact>>({
    loading: true,
    data: null,
    error: null,
  });
  useEffect(() => {
    let active = true;
    catalogCache.promise ??= fetch(
      `${import.meta.env.BASE_URL}data/catalog.json`,
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            `Scientific catalog request failed (${response.status}).`,
          );
        return validateCatalog(await response.json());
      })
      .catch((error) => {
        catalogCache.promise = undefined;
        throw error;
      });
    catalogCache.promise.then(
      (data) => {
        if (active) setState({ loading: false, data, error: null });
      },
      (error) => {
        if (active)
          setState({
            loading: false,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Scientific catalog unavailable.",
          });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
