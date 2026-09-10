import { useId, useState } from "react";
import { useShellLang } from "@fasl-work/caos-app-shell";

export type DiagramKind =
  | "network"
  | "fans"
  | "uncertainty"
  | "transport"
  | "mlp"
  | "graph"
  | "pipeline"
  | "split";

/** Authored scientific schematics, not simulation output or decoration. */
export default function ScienceDiagram({ kind }: { kind: DiagramKind }) {
  const es = useShellLang() === "es";
  const [fullSize, setFullSize] = useState(false);
  const id = useId().replace(/:/g, "");
  const b = (en: string, spanish: string) => (es ? spanish : en);
  const names: Record<DiagramKind, string> = {
    network: b("Network conservation", "Conservación de red"),
    fans: b("Fan operating point", "Punto operativo de ventilador"),
    uncertainty: b("Resistance uncertainty", "Incertidumbre de resistencia"),
    transport: b("Passive tracer", "Trazador pasivo"),
    mlp: b("Multilayer model", "Modelo multicapa"),
    graph: b("Message passing", "Paso de mensajes"),
    pipeline: b("Scientific pipeline", "Proceso científico"),
    split: b("Data partitions", "Particiones de datos"),
  };
  const fg = "var(--color-fg)",
    muted = "var(--color-fg-subtle)",
    border = "var(--color-border)",
    accent = "var(--color-accent)",
    good = "var(--color-good)",
    warn = "var(--color-warn)";
  const arrow = `url(#${id}-arrow)`;
  const node = (x: number, y: number, label: string, color = accent) => (
    <g key={`${x}-${y}-${label}`}>
      <circle
        cx={x}
        cy={y}
        r="19"
        fill="var(--color-surface)"
        stroke={color}
        strokeWidth="2"
      />
      <text x={x} y={y + 5} textAnchor="middle" fill={fg} fontSize="12">
        {label}
      </text>
    </g>
  );
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color = muted,
  ) => (
    <line
      x1={x}
      y1={y}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth="2"
      markerEnd={arrow}
    />
  );
  const fanCurve = (head: (q: number) => number) =>
    Array.from({ length: 51 }, (_, index) => {
      const q = index * 2;
      return `${65 + q * 6.15},${240 - (head(q) * 190) / 1200}`;
    }).join(" ");
  return (
    <div className="av-scientific-figure">
      <div className="av-diagram-tools">
        <button
          type="button"
          aria-expanded={fullSize}
          onClick={() => setFullSize((value) => !value)}
        >
          {fullSize
            ? b("Fit diagram", "Ajustar diagrama")
            : b("Read at full size", "Leer a tamaño completo")}
        </button>
        <span>
          {fullSize
            ? b(
                "Scroll horizontally to inspect all labels.",
                "Desplace horizontalmente para leer todas las etiquetas.",
              )
            : b(
                "Authored schematic; equations define the model.",
                "Esquema creado; las ecuaciones definen el modelo.",
              )}
        </span>
      </div>
      <div
        className="av-diagram-viewport"
        tabIndex={fullSize ? 0 : undefined}
        role="group"
        aria-label={names[kind]}
      >
        <svg
          viewBox="0 0 760 290"
          width="100%"
          role="img"
          aria-labelledby={`${id}-title`}
          style={{
            fontFamily: "var(--font-sans, sans-serif)",
            display: "block",
            minWidth: fullSize ? 760 : undefined,
          }}
        >
          <title id={`${id}-title`}>
            {b("Scientific schematic: ", "Esquema científico: ")}
            {kind}
          </title>
          <defs>
            <marker
              id={`${id}-arrow`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 Z" fill={muted} />
            </marker>
          </defs>
          {kind === "network" && (
            <>
              <text x="28" y="28" fill={fg} fontSize="16">
                {b(
                  "One network, two coupled conservation laws",
                  "Una red, dos leyes de conservación acopladas",
                )}
              </text>
              {line(87, 145, 260, 75, accent)}
              {line(87, 145, 260, 220, accent)}
              {line(296, 75, 500, 145, good)}
              {line(296, 220, 500, 145, good)}
              {line(537, 145, 687, 145, warn)}
              {node(68, 145, "p₀")}
              {node(280, 68, "p₁")}
              {node(280, 228, "p₂")}
              {node(520, 145, "p₃")}
              {node(710, 145, "p₄")}
              <text x="140" y="83" fill={accent} fontSize="12">
                Q₁, R₁
              </text>
              <text x="145" y="226" fill={accent} fontSize="12">
                Q₂, R₂
              </text>
              <text x="335" y="45" fill={good} fontSize="12">
                Q₁ = Q₃
              </text>
              <text x="340" y="264" fill={good} fontSize="12">
                Q₂ = Q₄
              </text>
              <text x="570" y="116" fill={warn} fontSize="12">
                H = H₀s² − kQ|Q|
              </text>
              <text x="354" y="145" textAnchor="middle" fill={fg} fontSize="14">
                BᵢQ = 0
              </text>
              <text
                x="354"
                y="166"
                textAnchor="middle"
                fill={muted}
                fontSize="11"
              >
                Δp + H = RQ|Q|
              </text>
              <text x="24" y="280" fill={muted} fontSize="11">
                {b(
                  "Boundary pressures anchor the solution; arrows define positive flow, not an imposed result.",
                  "Las presiones de borde anclan la solución; las flechas definen el caudal positivo, no lo imponen.",
                )}
              </text>
            </>
          )}
          {kind === "fans" && (
            <>
              <text x="28" y="28" fill={fg} fontSize="16">
                {b(
                  "An operating point requires both fan and network",
                  "El punto operativo requiere ventilador y red",
                )}
              </text>
              {line(65, 240, 680, 240)}
              {line(65, 240, 65, 45)}
              <polyline
                points={fanCurve((q) => 900 - 0.04 * q * q)}
                fill="none"
                stroke={accent}
                strokeWidth="3"
              />
              <polyline
                points={fanCurve((q) => 0.12 * q * q)}
                fill="none"
                stroke={good}
                strokeWidth="3"
              />
              <polyline
                points={fanCurve((q) => 900 * 0.8 ** 2 - 0.04 * q * q)}
                fill="none"
                stroke={accent}
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <circle cx="526.25" cy="133.125" r="6" fill={warn} />
              <path
                d="M526.25 133.125 V240 M526.25 133.125 H65"
                fill="none"
                stroke={border}
                strokeDasharray="4 4"
              />
              <text x="87" y="58" fill={accent} fontSize="12">
                H₀s² − kQ²
              </text>
              <text x="538" y="55" fill={good} fontSize="12">
                Rₑq Q²
              </text>
              <text x="535" y="121" fill={fg} fontSize="12">
                {b("solved intersection", "intersección calculada")}
              </text>
              <text x="295" y="267" fill={fg} fontSize="12">
                {b("Volume flow Q (m³/s)", "Caudal Q (m³/s)")}
              </text>
              <text
                x="15"
                y="155"
                fill={fg}
                fontSize="12"
                transform="rotate(-90 15 155)"
              >
                {b("Pressure H (Pa)", "Presión H (Pa)")}
              </text>
            </>
          )}
          {kind === "uncertainty" && (
            <>
              <text x="28" y="28" fill={fg} fontSize="16">
                {b(
                  "Resistance assumptions propagate through the same equations",
                  "Los supuestos de resistencia atraviesan las mismas ecuaciones",
                )}
              </text>
              <path
                d="M30 218 C90 218 100 50 148 80 C210 120 220 210 267 218"
                fill="none"
                stroke={accent}
                strokeWidth="3"
              />
              <text x="41" y="248" fill={fg} fontSize="12">
                R·exp(σZ − σ²/2)
              </text>
              {line(277, 145, 339, 145)}
              <rect
                x="352"
                y="78"
                width="157"
                height="136"
                rx="7"
                fill="var(--color-surface)"
                stroke={good}
              />
              <text x="430" y="107" fill={fg} textAnchor="middle" fontSize="13">
                {b("Each realization", "Cada realización")}
              </text>
              <text
                x="430"
                y="138"
                fill={good}
                textAnchor="middle"
                fontSize="13"
              >
                BᵢQ = 0
              </text>
              <text
                x="430"
                y="163"
                fill={good}
                textAnchor="middle"
                fontSize="13"
              >
                Δp + H = RQ|Q|
              </text>
              <text
                x="430"
                y="192"
                fill={muted}
                textAnchor="middle"
                fontSize="11"
              >
                {b("residual gate", "control de residuos")}
              </text>
              {line(521, 145, 579, 145)}
              <line
                x1="602"
                y1="147"
                x2="732"
                y2="147"
                stroke={accent}
                strokeWidth="6"
              />
              <circle cx="672" cy="147" r="7" fill={good} />
              <text x="594" y="124" fill={fg} fontSize="11">
                p05
              </text>
              <text x="660" y="124" fill={fg} fontSize="11">
                p50
              </text>
              <text x="716" y="124" fill={fg} fontSize="11">
                p95
              </text>
              <text x="582" y="194" fill={muted} fontSize="11">
                {b("Conditional flow interval", "Intervalo condicional")}
              </text>
              <text x="30" y="279" fill={warn} fontSize="11">
                {b(
                  "Assumed uncertainty is not an empirically calibrated safety probability.",
                  "La incertidumbre supuesta no es una probabilidad de seguridad calibrada.",
                )}
              </text>
            </>
          )}
          {kind === "transport" && (
            <>
              <text x="28" y="28" fill={fg} fontSize="16">
                {b(
                  "Conservative transport follows the solved flow direction",
                  "El transporte conservativo sigue el caudal calculado",
                )}
              </text>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <g key={i}>
                  <rect
                    x={44 + i * 108}
                    y="104"
                    width="93"
                    height="84"
                    fill={
                      i < 3
                        ? "var(--color-accent-soft)"
                        : "var(--color-surface)"
                    }
                    stroke={border}
                  />
                  <text
                    x={90 + i * 108}
                    y="139"
                    fill={fg}
                    fontSize="12"
                    textAnchor="middle"
                  >
                    C{i + 1}
                  </text>
                  <text
                    x={90 + i * 108}
                    y="167"
                    fill={muted}
                    fontSize="10"
                    textAnchor="middle"
                  >
                    V = AΔx
                  </text>
                  {i < 5 &&
                    line(139 + i * 108, 146, 150 + i * 108, 146, accent)}
                </g>
              ))}
              <text x="42" y="78" fill={accent} fontSize="12">
                {b("Source pulse", "Pulso de origen")}
              </text>
              <text x="312" y="78" fill={fg} fontSize="12">
                u = |Q| / A
              </text>
              <text x="83" y="229" fill={fg} fontSize="13">
                Vᵢ dCᵢ/dt = Q(Cᵢ₋₁ − Cᵢ)
              </text>
              <text x="411" y="229" fill={good} fontSize="12">
                {b(
                  "At a junction: mix incoming mass",
                  "En una unión: mezclar masa entrante",
                )}
              </text>
              <text x="42" y="269" fill={warn} fontSize="11">
                {b(
                  "Cross-section mean concentration; no resolved eddies, fire or toxicology.",
                  "Concentración media de sección; sin remolinos resueltos, incendio ni toxicología.",
                )}
              </text>
            </>
          )}
          {(kind === "mlp" || kind === "graph") && (
            <>
              <text x="28" y="28" fill={fg} fontSize="16">
                {kind === "mlp"
                  ? b(
                      "Learn an input-to-response map within its training scope",
                      "Aprender la respuesta dentro del dominio de entrenamiento",
                    )
                  : b(
                      "Message passing shares local rules over a network",
                      "Los mensajes comparten reglas locales sobre la red",
                    )}
              </text>
              {kind === "mlp" ? (
                <>
                  {[0, 1, 2].map((i) => node(70, 84 + i * 66, `x${i + 1}`))}
                  {[0, 1, 2, 3].map((i) =>
                    node(330, 65 + i * 54, `h${i + 1}`, good),
                  )}
                  {[0, 1, 2].map((i) =>
                    node(667, 84 + i * 66, `y${i + 1}`, warn),
                  )}
                  {[0, 1, 2].flatMap((i) =>
                    [0, 1, 2, 3].map((j) => (
                      <line
                        key={`${i}-${j}`}
                        x1="92"
                        y1={84 + i * 66}
                        x2="308"
                        y2={65 + j * 54}
                        stroke={border}
                      />
                    )),
                  )}
                  {[0, 1, 2, 3].flatMap((i) =>
                    [0, 1, 2].map((j) => (
                      <line
                        key={`${i}-${j}`}
                        x1="352"
                        y1={65 + i * 54}
                        x2="645"
                        y2={84 + j * 66}
                        stroke={border}
                      />
                    )),
                  )}
                </>
              ) : (
                <>
                  {line(106, 110, 258, 190)}
                  {line(295, 187, 463, 102)}
                  {line(298, 205, 462, 225)}
                  {line(492, 113, 492, 205)}
                  {node(83, 98, "u")}
                  {node(279, 203, "v")}
                  {node(488, 91, "w")}
                  {node(488, 229, "z")}
                  <text x="527" y="126" fill={good} fontSize="12">
                    mᵤᵥ = φ(hᵤ, hᵥ, eᵤᵥ)
                  </text>
                  <text x="527" y="155" fill={fg} fontSize="12">
                    hᵥ′ = ψ(hᵥ, Σ mᵤᵥ)
                  </text>
                  <text x="58" y="56" fill={muted} fontSize="11">
                    {b(
                      "Connectivity is an input",
                      "La conectividad es entrada",
                    )}
                  </text>
                </>
              )}
              <text x="31" y="279" fill={warn} fontSize="11">
                {b(
                  "A prediction remains approximate: compare to a held-out numerical reference and physical residuals.",
                  "Una predicción es aproximada: comparar con referencia reservada y residuos físicos.",
                )}
              </text>
            </>
          )}
          {(kind === "pipeline" || kind === "split") && (
            <>
              <text x="28" y="28" fill={fg} fontSize="16">
                {kind === "split"
                  ? b(
                      "Partition before fitting; preserve the held-out question",
                      "Separar antes del ajuste; preservar la prueba reservada",
                    )
                  : b(
                      "Offline scientific evidence and a separately checked live tool",
                      "Evidencia científica local y herramienta en vivo verificada",
                    )}
              </text>
              {[
                [
                  32,
                  74,
                  210,
                  kind === "split"
                    ? b("Source families", "Familias de origen")
                    : b("Validate network", "Validar red"),
                  b("SI · topology · provenance", "SI · topología · origen"),
                ],
                [
                  275,
                  74,
                  210,
                  kind === "split"
                    ? b("Train / validation", "Entrenar / validar")
                    : b("Reference + batch", "Referencia + lote"),
                  kind === "split"
                    ? b("fit → tune → freeze", "ajustar → elegir → fijar")
                    : b("SciPy · CUDA · residuals", "SciPy · CUDA · residuos"),
                ],
                [
                  519,
                  74,
                  210,
                  kind === "split"
                    ? b("Held-out evaluation", "Evaluación reservada")
                    : b("Checked artifacts", "Artefactos verificados"),
                  kind === "split"
                    ? b(
                        "predict → score → export",
                        "predecir → medir → exportar",
                      )
                    : b(
                        "SHA-256 · schema · metrics",
                        "SHA-256 · esquema · métricas",
                      ),
                ],
              ].map(([x, y, w, title, sub], i) => (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height="105"
                    rx="6"
                    fill="var(--color-surface)"
                    stroke={i === 1 ? accent : good}
                  />
                  <text x={Number(x) + 14} y="109" fill={fg} fontSize="13">
                    {title}
                  </text>
                  <text x={Number(x) + 14} y="142" fill={muted} fontSize="11">
                    {sub}
                  </text>
                </g>
              ))}
              {line(245, 126, 271, 126)}
              {line(490, 126, 516, 126)}
              {kind === "split" ? (
                <>
                  <path
                    d="M625 184 V235 H385 V184"
                    fill="none"
                    stroke={warn}
                    strokeDasharray="5 4"
                  />
                  <line
                    x1="460"
                    y1="211"
                    x2="500"
                    y2="255"
                    stroke={warn}
                    strokeWidth="3"
                  />
                  <line
                    x1="500"
                    y1="211"
                    x2="460"
                    y2="255"
                    stroke={warn}
                    strokeWidth="3"
                  />
                  <text x="28" y="268" fill={warn} fontSize="12">
                    {b(
                      "Forbidden: use test outcomes to fit scaling, select epochs or retune thresholds.",
                      "Prohibido: usar resultados de prueba para escalar, elegir épocas o ajustar umbrales.",
                    )}
                  </text>
                </>
              ) : (
                <>
                  <rect
                    x="225"
                    y="220"
                    width="310"
                    height="47"
                    rx="5"
                    fill="var(--color-surface)"
                    stroke={accent}
                  />
                  <text
                    x="380"
                    y="250"
                    fill={fg}
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {b(
                      "Browser · edit → compute → compare",
                      "Navegador · editar → calcular → comparar",
                    )}
                  </text>
                  <path
                    d="M623 183 V244 H540"
                    fill="none"
                    stroke={muted}
                    markerEnd={arrow}
                  />
                  <text x="548" y="211" fill={muted} fontSize="10">
                    {b("read only", "solo lectura")}
                  </text>
                </>
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
