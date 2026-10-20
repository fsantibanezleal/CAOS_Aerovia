import type { Citation } from "@fasl-work/caos-app-shell";

/** Citations only the Introduction references. A citation two pages reference stays in `../citations.ts`. */
export const introductionCitations: Citation[] = [
  {
    id: "nioshmfire",
    label: "NIOSH · MFIRE",
    citation:
      "National Institute for Occupational Safety and Health. MFIRE software: mine ventilation and fire modeling.",
    url: "https://www.cdc.gov/niosh/mining/tools/mfire.html",
  },
];
