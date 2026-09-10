import type { Network, Options, Result } from "../contracts";
import Plot from "./Plot";

export type FanOperatingState =
  | { kind: "no-fans" }
  | { kind: "all-closed" }
  | { kind: "unavailable" }
  | {
      kind: "active";
      edge: Network["edges"][number];
      flow: number;
      pressure: number;
      activeFans: number;
      equivalent: boolean;
      reason:
        | "equivalent"
        | "zero-speed"
        | "no-flow"
        | "multiple-fans"
        | "boundary-pressure";
    };

/** Only open, supported fan branches can supply an operating-point visualization. */
export function fanOperatingState(
  network: Network,
  options: Options,
  result: Result,
): FanOperatingState {
  const fans = network.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.fan);
  if (!fans.length) return { kind: "no-fans" };
  const active = fans.filter(({ edge }) => !options.overrides[edge.id]?.closed);
  if (!active.length) return { kind: "all-closed" };
  if (!result.converged || result.flows.length !== network.edges.length)
    return { kind: "unavailable" };
  const { edge, index } = active[0];
  const flow = result.flows[index];
  const pressure =
    edge.fan!.pressure * options.speed ** 2 -
    edge.fan!.coefficient * flow * Math.abs(flow);
  if (
    !Number.isFinite(flow) ||
    !Number.isFinite(pressure) ||
    flow < -1e-6 ||
    pressure < -1e-5
  )
    return { kind: "unavailable" };
  const boundaries = network.nodes.flatMap((node) =>
    node.boundary === undefined ? [] : [node.boundary],
  );
  const commonBoundary = boundaries.every(
    (pressure) => pressure === boundaries[0],
  );
  const reason =
    options.speed === 0
      ? "zero-speed"
      : flow <= 1e-6
        ? "no-flow"
        : active.length > 1
          ? "multiple-fans"
          : !commonBoundary
            ? "boundary-pressure"
            : "equivalent";
  return {
    kind: "active",
    edge,
    flow,
    pressure,
    activeFans: active.length,
    equivalent: reason === "equivalent",
    reason,
  };
}

/** Positive-flow, nonnegative-head fan domain; no fabricated flat tail after free delivery. */
export function fanCurveSamples(
  edge: Network["edges"][number],
  speed: number,
  operatingFlow: number,
) {
  const fan = edge.fan!;
  const shutoff = fan.pressure * speed ** 2;
  const freeDelivery =
    fan.coefficient > 0 ? Math.sqrt(shutoff / fan.coefficient) : Infinity;
  const maximum = Math.min(Math.max(1, operatingFlow * 1.8), freeDelivery);
  return Array.from({ length: 65 }, (_, index) => {
    const x = (maximum * index) / 64;
    return { x, y: Math.max(0, shutoff - fan.coefficient * x * x) };
  });
}
export default function FanPlot({
  network,
  options,
  result,
  lang,
}: {
  network: Network;
  options: Options;
  result: Result;
  lang: "en" | "es";
}) {
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  const state = fanOperatingState(network, options, result);
  if (state.kind === "no-fans")
    return (
      <div className="analysis-card">
        <h3>{b("Pressure-driven network", "Red impulsada por presión")}</h3>
        <p>
          {b(
            "This network contains no fan branches. Flow is driven by its entered boundary pressures.",
            "Esta red no contiene ramas de ventilador. El flujo responde a las presiones de borde ingresadas.",
          )}
        </p>
      </div>
    );
  if (state.kind === "all-closed")
    return (
      <div className="analysis-card">
        <h3>
          {b(
            "All fan branches are closed",
            "Todas las ramas de ventilador están cerradas",
          )}
        </h3>
        <p>
          {b(
            "Closed branches are excluded from the solved pressure network. No active fan operating point or delivered fan pressure is shown.",
            "Las ramas cerradas se excluyen de la red de presión resuelta. No se muestra un punto de operación ni una presión entregada de ventilador activo.",
          )}
        </p>
      </div>
    );
  if (state.kind === "unavailable")
    return (
      <div className="analysis-card">
        <h3>
          {b(
            "Fan operating point unavailable",
            "Punto de operación no disponible",
          )}
        </h3>
        <p>
          {b(
            "A supported, converged solution for the current network is required.",
            "Se requiere una solución convergente y admitida para la red actual.",
          )}
        </p>
      </div>
    );
  const e = state.edge;
  const q = state.flow,
    head = state.pressure;
  const fan = fanCurveSamples(e, options.speed, q);
  const equivalent = state.equivalent;
  const resistance = equivalent ? head / (q * q) : 0;
  const system = fan.map(({ x }) => ({ x, y: resistance * x * x }));
  return (
    <div className="analysis-grid">
      <Plot
        title={b("Fan operating point", "Punto de operación del ventilador")}
        xlabel="m³/s"
        ylabel="Pa"
        series={[
          { label: e.name[lang], color: "#dcb274", values: fan },
          ...(equivalent
            ? [
                {
                  label: b("Equivalent network", "Red equivalente"),
                  color: "#58c7b5",
                  values: system,
                },
              ]
            : []),
        ]}
        markers={[
          {
            x: q,
            y: head,
            label: b("Current operating point", "Punto actual"),
            color: "#b8b1f2",
          },
        ]}
      />
      <div className="analysis-card">
        <div className="section-label">
          <span>
            {b("PRESSURE MEETS RESISTANCE", "PRESIÓN FRENTE A RESISTENCIA")}
          </span>
          <span>{b("current calculation", "cálculo actual")}</span>
        </div>
        <h2 className="fan-headline">
          {b(
            "The fan and the mine set the flow together.",
            "El ventilador y la mina determinan juntos el caudal.",
          )}
        </h2>
        <p>
          {b(
            "The fan curve is evaluated at the current speed. Its operating point is the independently balanced network solution. Resistance changes move that point; increasing speed raises available pressure.",
            "La curva se evalúa a la velocidad actual. El punto de operación corresponde a la solución equilibrada de la red. Cambiar resistencias desplaza ese punto; aumentar velocidad eleva la presión disponible.",
          )}
        </p>
        <p>
          {b(
            "The plotted fan curve is restricted to forward flow and nonnegative delivered pressure. Its domain ends at free delivery when the quadratic coefficient is positive.",
            "La curva mostrada se restringe al caudal hacia adelante y presión entregada no negativa. Su dominio termina en descarga libre cuando el coeficiente cuadrático es positivo.",
          )}
        </p>
        <div className="cost-line">
          <span>{b("Delivered fan pressure", "Presión entregada")}</span>
          <strong>{head.toFixed(1)} Pa</strong>
        </div>
        <div className="cost-line">
          <span>{b("Volume flow through fan", "Caudal del ventilador")}</span>
          <strong>{q.toFixed(2)} m³/s</strong>
        </div>
        <p>
          {equivalent
            ? b(
                "The equivalent system curve applies to this single active fan, equal boundary pressures and fixed quadratic resistances.",
                "La curva equivalente corresponde a este único ventilador activo, presiones de borde iguales y resistencias cuadráticas fijas.",
              )
            : state.reason === "zero-speed"
              ? b(
                  "The common fan speed is zero. A system curve cannot be inferred from this stopped operating point.",
                  "La velocidad común es cero. No se puede inferir una curva del sistema desde este punto detenido.",
                )
              : state.reason === "no-flow"
                ? b(
                    "There is no supported forward fan flow at this setting. The pressure shown is the fan curve value; an equivalent resistance cannot be inferred at zero flow.",
                    "No hay caudal hacia adelante admitido en esta configuración. La presión corresponde a la curva del ventilador; no se puede inferir una resistencia equivalente con caudal cero.",
                  )
                : state.reason === "boundary-pressure"
                  ? b(
                      "Unequal imposed boundary pressures add another pressure driver. A single quadratic equivalent system curve is not inferred.",
                      "Las presiones de borde distintas añaden otra fuerza impulsora. No se infiere una curva equivalente cuadrática única.",
                    )
                  : b(
                      "This network has multiple pressure sources. A single equivalent system curve is not inferred.",
                      "Esta red tiene múltiples fuentes de presión. No se infiere una curva equivalente única.",
                    )}
        </p>
      </div>
    </div>
  );
}
