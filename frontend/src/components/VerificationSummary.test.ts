import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readBenchmark } from "./VerificationSummary";

const catalog = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../data/artifacts/catalog.json"),
    "utf-8",
  ),
);

describe("verification record interpretation", () => {
  it("derives the readable summary from the actual baked benchmark", () => {
    const result = readBenchmark(catalog.benchmark, catalog.cases.length);
    expect(result).not.toBeNull();
    expect(result!.ensembleSamples).toBe(catalog.benchmark.ensembleSamples);
    expect(result!.parityMaxAbsFlow).toBe(catalog.benchmark.parityMaxAbsFlow);
    expect(result!.hardware).toBe(catalog.benchmark.hardware);
  });
  it("does not invent zero failures or successful residuals when fields are absent", () => {
    const partial = { ...catalog.benchmark };
    delete partial.ensembleFailures;
    expect(readBenchmark(partial, catalog.cases.length)).toBeNull();
    expect(readBenchmark({}, catalog.cases.length)).toBeNull();
  });
  it("rejects a record for a different case library or inconsistent sample population", () => {
    expect(readBenchmark(catalog.benchmark, 999)).toBeNull();
    expect(
      readBenchmark(
        { ...catalog.benchmark, ensembleSamples: 1 },
        catalog.cases.length,
      ),
    ).toBeNull();
    expect(
      readBenchmark(
        {
          ...catalog.benchmark,
          paritySamples: catalog.benchmark.ensembleSamples + 1,
        },
        catalog.cases.length,
      ),
    ).toBeNull();
  });
  it("rejects non-finite and negative metrics while preserving legitimate failures for display", () => {
    expect(
      readBenchmark(
        { ...catalog.benchmark, maxMassResidual: NaN },
        catalog.cases.length,
      ),
    ).toBeNull();
    expect(
      readBenchmark(
        { ...catalog.benchmark, referenceElapsedMs: -1 },
        catalog.cases.length,
      ),
    ).toBeNull();
    expect(
      readBenchmark(
        { ...catalog.benchmark, ensembleFailures: 1 },
        catalog.cases.length,
      )!.ensembleFailures,
    ).toBe(1);
  });
});
