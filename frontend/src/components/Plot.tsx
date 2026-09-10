import { useEffect, useRef, useState } from "react";
import "./plot.css";
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
  onSelect,
}: {
  series: Series[];
  xlabel: string;
  ylabel: string;
  title: string;
  format?: (v: number) => string;
  markers?: { x: number; y: number; label: string; color: string }[];
  onSelect?: (x: number) => void;
}) {
  const [cursor, setCursor] = useState<number | null>(null),
    [size, setSize] = useState({ width: 580, height: 220 });
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0)
        setSize({ width: Math.max(200, width), height: Math.max(75, height) });
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const valid = series.map((s) => ({
    ...s,
    values: s.values.filter(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
    ),
  }));
  const points = valid.flatMap((s) => s.values),
    minx = Math.min(0, ...points.map((p) => p.x)),
    maxDataX = Math.max(0, ...points.map((p) => p.x)),
    maxx = maxDataX > minx ? maxDataX : minx + 1;
  const low = Math.min(0, ...points.map((p) => p.y)),
    high = Math.max(0, ...points.map((p) => p.y)),
    padding = Math.max((high - low) * 0.06, Math.abs(high) * 0.01, 1e-15),
    miny = low === 0 ? 0 : low - padding,
    maxy = high + padding;
  const left = 57,
    right = size.width - 12,
    top = 10,
    bottom = size.height - 30;
  const x = (v: number) => left + ((v - minx) / (maxx - minx)) * (right - left),
    y = (v: number) => bottom - ((v - miny) / (maxy - miny)) * (bottom - top);
  const nearest = valid.map((s) => ({
    ...s,
    point:
      cursor === null
        ? null
        : s.values.reduce<{ x: number; y: number } | null>(
            (a, p) =>
              !a || Math.abs(p.x - cursor) < Math.abs(a.x - cursor) ? p : a,
            null,
          ),
  }));
  const at = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return (
      minx +
      Math.max(
        0,
        Math.min(
          1,
          (((clientX - rect.left) / rect.width) * size.width - left) /
            (right - left),
        ),
      ) *
        (maxx - minx)
    );
  };
  return (
    <div className="plot av-plot">
      <div className="plot-heading">
        <h3>{title}</h3>
        <span>{ylabel}</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`${title}, ${xlabel}, ${ylabel}`}
        tabIndex={onSelect ? 0 : undefined}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={(e) => setCursor(at(e.clientX))}
        onClick={(e) => onSelect?.(at(e.clientX))}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            setCursor(
              Math.max(
                minx,
                Math.min(
                  maxx,
                  (cursor ?? minx) +
                    ((maxx - minx) / 100) * (e.key === "ArrowRight" ? 1 : -1),
                ),
              ),
            );
          }
          if (e.key === "Enter" && cursor !== null) onSelect?.(cursor);
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={right}
              y1={top + t * (bottom - top)}
              y2={top + t * (bottom - top)}
              className="plot-grid"
            />
            <text
              x={left - 7}
              y={top + t * (bottom - top) + 3}
              textAnchor="end"
            >
              {format(maxy - t * (maxy - miny))}
            </text>
            <text
              x={left + t * (right - left)}
              y={bottom + 15}
              textAnchor="middle"
            >
              {(minx + t * (maxx - minx)).toFixed(1)}
            </text>
          </g>
        ))}
        {valid.map((s) => (
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
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {cursor !== null && (
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={top}
            y2={bottom}
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
                r="3.5"
                fill={s.color}
              />
            ),
        )}
        {markers
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .map((p) => (
            <g key={p.label}>
              <line
                x1={x(p.x)}
                x2={x(p.x)}
                y1={top}
                y2={bottom}
                stroke={p.color}
                strokeDasharray="3 4"
                opacity=".6"
              />
              <circle
                cx={x(p.x)}
                cy={y(p.y)}
                r="4.5"
                fill={p.color}
                stroke="var(--color-surface)"
                strokeWidth="1.5"
              />
              <text
                x={Math.min(right - 45, x(p.x) + 7)}
                y={Math.max(12, y(p.y) - 10)}
              >
                {p.label}
              </text>
            </g>
          ))}
        <text x={(left + right) / 2} y={size.height - 2} textAnchor="middle">
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
                {s.point.x.toFixed(2)} {xlabel}: {format(s.point.y)} {ylabel}
              </strong>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
