import { describe, expect, it } from "vitest";
import { CONTENT_CITATIONS } from "./citations";
import { introductionCitations } from "./citations/introduction";
import { methodologyCitations } from "./citations/methodology";
import { implementationCitations } from "./citations/implementation";
import { experimentsCitations } from "./citations/experiments";
import {
  benchmarkCitations,
  benchmarkSectionRefs,
} from "./citations/benchmark";
import { introductionSections } from "./introduction";
import { classicalMethods } from "./methods";
import { learnedMethods } from "./learned-methods";
import { implementationSections } from "./implementation";
import { experimentSections } from "./experiments";

// The citations are split per page so the page units write disjoint files (CAOS_MANAGE plans/aerovia/plan.md, U5). The
// composed list is the one the single file held: the same ids, in the same order, with the same links.
const PREVIOUS: [string, string][] = [
  ["mcpherson1993", "https://www.srk.com/en/products/ventilation-textbook"],
  [
    "scipytrf",
    "https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html",
  ],
  [
    "scipybisect",
    "https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.bisect.html",
  ],
  [
    "pytorchsolve",
    "https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html",
  ],
  [
    "numpylognormal",
    "https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.lognormal.html",
  ],
  ["nioshmfire", "https://www.cdc.gov/niosh/mining/tools/mfire.html"],
  ["battaglia2018", "https://arxiv.org/abs/1806.01261"],
  ["sklearnleakage", "https://scikit-learn.org/stable/common_pitfalls.html"],
  [
    "sklearnmetrics",
    "https://scikit-learn.org/stable/modules/model_evaluation.html",
  ],
  [
    "mdnworkers",
    "https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers",
  ],
  [
    "githubpages",
    "https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits",
  ],
  [
    "nistcontam",
    "https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1887r1.pdf",
  ],
  [
    "clawpackadvection",
    "https://www.clawpack.org/riemann_book/html/Advection.html",
  ],
  ["jong2016", "https://stacks.cdc.gov/view/cdc/207736"],
  [
    "networkxpaths",
    "https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html",
  ],
  ["gilmer2017", "https://proceedings.mlr.press/v70/gilmer17a.html"],
  ["ashraf2024", "https://arxiv.org/html/2403.18570v1"],
  [
    "onnxweb",
    "https://onnxruntime.ai/docs/get-started/with-javascript/web.html",
  ],
];

const refsOf = (sections: { refs: string[] }[]) =>
  sections.flatMap((s) => s.refs);
const pageRefs = {
  introduction: new Set(refsOf(introductionSections)),
  methodology: new Set([
    ...refsOf(classicalMethods),
    ...refsOf(learnedMethods),
  ]),
  implementation: new Set(refsOf(implementationSections)),
  experiments: new Set(refsOf(experimentSections)),
  benchmark: new Set(Object.values(benchmarkSectionRefs).flat()),
};
const files = {
  introduction: introductionCitations,
  methodology: methodologyCitations,
  implementation: implementationCitations,
  experiments: experimentsCitations,
  benchmark: benchmarkCitations,
};
const used = new Set(Object.values(pageRefs).flatMap((s) => [...s]));

describe("the per-page citations", () => {
  it("compose to exactly the previous list: same ids, same order, same links", () => {
    expect(CONTENT_CITATIONS.map((c) => [c.id, c.url])).toEqual(PREVIOUS);
  });

  it("have unique ids across the composed list and the five page files", () => {
    const own = Object.values(files).flat();
    expect(new Set(own.map((c) => c.id)).size).toBe(own.length);
    const composed = CONTENT_CITATIONS.map((c) => c.id);
    expect(new Set(composed).size).toBe(composed.length);
  });

  it("exist for every id a section or a Benchmark section references", () => {
    const known = new Set(CONTENT_CITATIONS.map((c) => c.id));
    for (const id of used)
      expect(known.has(id), `unknown citation ${id}`).toBe(true);
  });

  it("are all used: no citation is left without a reference", () => {
    for (const c of CONTENT_CITATIONS)
      expect(used.has(c.id), `unused citation ${c.id}`).toBe(true);
  });

  it("keep each page file to the citations only that page references", () => {
    for (const [page, list] of Object.entries(files)) {
      for (const c of list) {
        expect(
          pageRefs[page as keyof typeof pageRefs].has(c.id),
          `${c.id} is not referenced by ${page}`,
        ).toBe(true);
        const elsewhere = Object.entries(pageRefs).filter(
          ([other, set]) => other !== page && set.has(c.id),
        );
        expect(
          elsewhere.map(([o]) => o),
          `${c.id} is shared and stays in citations.ts`,
        ).toEqual([]);
      }
    }
  });
});
