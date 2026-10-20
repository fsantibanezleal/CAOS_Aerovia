import type { Citation } from "@fasl-work/caos-app-shell";

/** Citations only Benchmark references. None is exclusive today; the Benchmark page unit adds its own here. */
export const benchmarkCitations: Citation[] = [];

/**
 * The citation ids each Benchmark section lists in the page's references block at the end of the open topic (the shell's
 * DocSection `refs`), by topic id.
 */
export const benchmarkSectionRefs: Record<string, string[]> = {
  numerical: ["scipytrf", "pytorchsolve", "numpylognormal"],
  matrix: ["sklearnmetrics", "sklearnleakage"],
  robustness: ["numpylognormal", "sklearnleakage", "gilmer2017"],
  uncertainty: ["numpylognormal", "pytorchsolve", "scipytrf"],
  provenance: ["sklearnleakage", "pytorchsolve", "onnxweb"],
};
