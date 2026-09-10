import { useState } from "react";
export interface Series {
  label: string;
  color: string;
  values: { x: number; y: number }[];
}
export default function Plot({
  series,
  xlabel,
  ylabel,
  title,
  format = (v: number) => v.toFixed(1),
  markers = [],
}: {
  series: Series[];
  xlabel: string;
  ylabel: string;
  title: string;
  format?: (v: number) => string;
  markers?: { x: number; y: number; label: string; color: string }[];
}) {
  const [cursor, setCursor] = useState<number | null>(null);
  const points = series
    .flatMap((s) => s.values)
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const minx = Math.min(0, ...points.map((p) => p.x)),
    maxx = Math.max(1, ...points.map((p) => p.x));
  const miny = Math.min(0, ...points.map((p) => p.y)),
    maxy = Math.max(1, ...points.map((p) => p.y)) * 1.06;
  const x = (v: number) => 52 + ((v - minx) / (maxx - minx)) * 500,
    y = (v: number) => 214 - ((v - miny) / (maxy - miny)) * 180;
  const nearest = series.map((s) => ({
    ...s,
    point:
      cursor === null
        ? null
        : s.values.reduce(
            (a, p) => (Math.abs(p.x - cursor) < Math.abs(a.x - cursor) ? p : a),
            s.values[0],
          ),
  }));
  return (
    <div className="plot">
      <div className="plot-heading">
        <h3>{title}</h3>
        <span>{ylabel}</span>
      </div>
      <svg
        viewBox="0 0 580 255"
        role="img"
        aria-label={`${title}, ${xlabel}, ${ylabel}`}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCursor(
            minx +
              Math.max(
                0,
                Math.min(
                  1,
                  (((e.clientX - rect.left) / rect.width) * 580 - 52) / 500,
                ),
              ) *
                (maxx - minx),
          );
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="52"
              x2="552"
              y1={34 + t * 180}
              y2={34 + t * 180}
              className="plot-grid"
            />
            <text x="43" y={38 + t * 180} textAnchor="end">
              {format(maxy - t * (maxy - miny))}
            </text>
            <text x={52 + t * 500} y="235" textAnchor="middle">
              {(minx + t * (maxx - minx)).toFixed(1)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path
            key={s.label}
            d={s.values
              .map(
                (p, i) =>
                  `${i ? "L" : "M"}${x(p.x).toFixed(2)},${y(p.y).toFixed(2)}`,
              )
              .join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2.7"
            strokeLinejoin="round"
          />
        ))}
        {cursor !== null && (
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1="34"
            y2="214"
            className="cursor-line"
          />
        )}
        {nearest.map(
          (s) =>
            s.point && (
              <circle
                key={s.label}
                cx={x(s.point.x)}
                cy={y(s.point.y)}
                r="4.5"
                fill={s.color}
              />
            ),
        )}
        {markers.map((p) => (
          <g key={p.label}>
            <circle
              cx={x(p.x)}
              cy={y(p.y)}
              r="6"
              fill={p.color}
              stroke="var(--panel)"
              strokeWidth="2"
            />
            <text x={Math.min(470, x(p.x) + 10)} y={Math.max(19, y(p.y) - 12)}>
              {p.label}
            </text>
          </g>
        ))}
        <text x="303" y="252" textAnchor="middle">
          {xlabel}
        </text>
      </svg>
      <div className="plot-legend">
        {nearest.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
            {s.point && (
              <strong>
                {s.point.x.toFixed(2)}: {format(s.point.y)}
              </strong>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
