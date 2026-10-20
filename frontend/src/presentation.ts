import { formatNumber as shellNumber } from "@fasl-work/caos-app-shell";

/** A value with a fixed number of decimals in the interface language (decimal comma in Spanish, no group separator:
 * coordinates and timings are read digit by digit). An absent or non-finite value reads "not available". */
export const fixed = (v: number, decimals: number, lang: "en" | "es") =>
  shellNumber(v, lang, { decimals, grouping: false });
/** Stable shared number presentation; no scientific transformation is performed. */
export const formatNumber = (v: number | undefined, d = 1) =>
  v === undefined || !Number.isFinite(v)
    ? "--"
    : v.toLocaleString(undefined, {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
