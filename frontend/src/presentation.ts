/** Stable shared number presentation; no scientific transformation is performed. */
export const formatNumber = (v: number | undefined, d = 1) =>
  v === undefined || !Number.isFinite(v)
    ? "--"
    : v.toLocaleString(undefined, {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
