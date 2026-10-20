import type { Citation } from "@fasl-work/caos-app-shell";

/** Citations only Methodology references (its classical and learned methods). A citation two pages reference stays in `../citations.ts`. */
export const methodologyCitations: Citation[] = [
  {
    id: "scipybisect",
    label: "SciPy · bisection",
    citation:
      "SciPy documentation. scipy.optimize.bisect: root bracketing by interval subdivision.",
    url: "https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.bisect.html",
  },
  {
    id: "battaglia2018",
    label: "Battaglia et al. 2018",
    citation:
      "P. W. Battaglia et al. Relational inductive biases, deep learning, and graph networks. 2018.",
    url: "https://arxiv.org/abs/1806.01261",
  },
  {
    id: "ashraf2024",
    label: "Ashraf et al. 2024",
    citation:
      "I. Ashraf et al. Physics-Informed Graph Neural Networks for Water Distribution Systems. AAAI 2024.",
    url: "https://arxiv.org/html/2403.18570v1",
  },
];
