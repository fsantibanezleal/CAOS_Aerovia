import type { Citation } from "@fasl-work/caos-app-shell";
import { introductionCitations } from "./citations/introduction";
import { methodologyCitations } from "./citations/methodology";
import { implementationCitations } from "./citations/implementation";
import { experimentsCitations } from "./citations/experiments";
import { benchmarkCitations } from "./citations/benchmark";

/**
 * Citations that two or more pages reference, verified in the dated research dossier before transcription. A citation only
 * one page references lives in that page's file under `citations/` (the page units write disjoint files).
 */
const SHARED_CITATIONS: Citation[] = [
  {
    id: "mcpherson1993",
    label: "McPherson · ventilation engineering",
    citation:
      "M. J. McPherson. Subsurface Ventilation Engineering. Chapters 5, 7 and 10. SRK-authorized English edition.",
    url: "https://www.srk.com/en/products/ventilation-textbook",
  },
  {
    id: "scipytrf",
    label: "SciPy · trust-region least squares",
    citation:
      "SciPy documentation. scipy.optimize.least_squares: nonlinear least squares and trust-region reflective algorithm.",
    url: "https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html",
  },
  {
    id: "pytorchsolve",
    label: "PyTorch · batched linear algebra",
    citation:
      "PyTorch documentation. torch.linalg.solve: batched linear systems.",
    url: "https://docs.pytorch.org/docs/stable/generated/torch.linalg.solve.html",
  },
  {
    id: "numpylognormal",
    label: "NumPy · lognormal sampling",
    citation:
      "NumPy documentation. Generator.lognormal: logarithmic parameters and sampling.",
    url: "https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.lognormal.html",
  },
  {
    id: "sklearnleakage",
    label: "scikit-learn · leakage controls",
    citation:
      "Scikit-learn documentation. Common pitfalls and recommended practices: inconsistent preprocessing and data leakage.",
    url: "https://scikit-learn.org/stable/common_pitfalls.html",
  },
  {
    id: "sklearnmetrics",
    label: "scikit-learn · metrics",
    citation:
      "Scikit-learn documentation. Metrics and scoring: quantifying the quality of predictions.",
    url: "https://scikit-learn.org/stable/modules/model_evaluation.html",
  },
  {
    id: "mdnworkers",
    label: "MDN · Web Workers",
    citation:
      "Mozilla contributors. Using Web Workers: isolated execution and structured messages.",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers",
  },
  {
    id: "githubpages",
    label: "GitHub · Pages limits",
    citation: "GitHub documentation. GitHub Pages limits.",
    url: "https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits",
  },
  {
    id: "nistcontam",
    label: "NIST · CONTAM theory",
    citation:
      "W. S. Dols and B. J. Polidoro. CONTAM User Guide and Program Documentation, Version 3.4. NIST Technical Note 1887, revision 1. Sections 8.1–8.2.",
    url: "https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1887r1.pdf",
  },
  {
    id: "clawpackadvection",
    label: "Clawpack · scalar advection",
    citation:
      "D. I. Ketcheson, R. J. LeVeque and M. J. del Razo. Riemann Problems and Jupyter Solutions. Scalar advection chapter.",
    url: "https://www.clawpack.org/riemann_book/html/Advection.html",
  },
  {
    id: "jong2016",
    label: "Jong et al. · mine tracer experiments",
    citation:
      "E. Jong, K. Luxbacher, H. McNair and C. Xu. Underground mine tracer study, archived by NIOSH.",
    url: "https://stacks.cdc.gov/view/cdc/207736",
  },
  {
    id: "networkxpaths",
    label: "NetworkX · shortest paths",
    citation:
      "NetworkX documentation. Shortest path algorithms and nonnegative weighted directed paths.",
    url: "https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html",
  },
  {
    id: "gilmer2017",
    label: "Gilmer et al. 2017",
    citation:
      "J. Gilmer et al. Neural Message Passing for Quantum Chemistry. Proceedings of Machine Learning Research 70, 2017.",
    url: "https://proceedings.mlr.press/v70/gilmer17a.html",
  },
  {
    id: "onnxweb",
    label: "ONNX Runtime · browser inference",
    citation: "ONNX Runtime documentation. Web inference with JavaScript.",
    url: "https://onnxruntime.ai/docs/get-started/with-javascript/web.html",
  },
];

/**
 * The order the single list had before the split, which the composed list keeps. A citation a page unit adds to its own file
 * is appended after these, in the order of the page files, so no unit edits this file.
 */
const ORDER = [
  "mcpherson1993",
  "scipytrf",
  "scipybisect",
  "pytorchsolve",
  "numpylognormal",
  "nioshmfire",
  "battaglia2018",
  "sklearnleakage",
  "sklearnmetrics",
  "mdnworkers",
  "githubpages",
  "nistcontam",
  "clawpackadvection",
  "jong2016",
  "networkxpaths",
  "gilmer2017",
  "ashraf2024",
  "onnxweb",
];

const POOL = [
  ...SHARED_CITATIONS,
  ...introductionCitations,
  ...methodologyCitations,
  ...implementationCitations,
  ...experimentsCitations,
  ...benchmarkCitations,
];

function compose(): Citation[] {
  const byId = new Map<string, Citation>();
  for (const c of POOL) {
    if (byId.has(c.id)) throw new Error(`citation ${c.id} is written twice`);
    byId.set(c.id, c);
  }
  const legacy = ORDER.map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`ORDER names the unknown citation ${id}`);
    return c;
  });
  return [...legacy, ...POOL.filter((c) => !ORDER.includes(c.id))];
}

/** Every citation of the product, for the shell's CitationsProvider: the shared ones and each page's own, in the previous order. */
export const CONTENT_CITATIONS: Citation[] = compose();
