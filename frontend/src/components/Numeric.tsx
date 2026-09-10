import { useEffect, useState } from "react";

export default function Numeric({
  label,
  value,
  min,
  max,
  step = 0.01,
  change,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  change: (value: number) => void;
  unit?: string;
}) {
  const formatted = String(Number(value.toPrecision(12)));
  const [draft, setDraft] = useState(formatted);
  useEffect(() => setDraft(formatted), [formatted]);
  return (
    <label className="numeric">
      <span>
        {label}
        {unit && <small>{unit}</small>}
      </span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === formatted) return;
          const n = Number(draft);
          if (draft !== "" && Number.isFinite(n) && n >= min && n <= max)
            change(n);
          else setDraft(formatted);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
