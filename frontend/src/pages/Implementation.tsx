import { useId } from "react";
import {
  DocPage,
  Figure,
  InlineMath,
  TabGroups,
  useShellLang,
} from "@fasl-work/caos-app-shell";
import { DeepSection, DocBody, tr } from "../content/primitives";
import {
  contractTables,
  implementationGroups,
  implementationSections,
  implementationTopics,
  type ContractTable,
} from "../content/implementation";
import ScienceDiagram from "../content/ScienceDiagram";

/** A field path with a line-break opportunity after each dot and comma, so a narrow column never cuts a word in two. */
const breakable = (path: string) =>
  path
    .split(/(?<=[.,])/)
    .flatMap((part, index) => (index ? [<wbr key={index} />, part] : [part]));

/** The contract of a section as a captioned table: the field, its unit and range, what it means (docs/data-contract). */
function ContractTableView({ table }: { table: ContractTable }) {
  const es = useShellLang() === "es";
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={tr(table.caption, es)}
      style={{ overflowX: "auto", maxWidth: "100%" }}
    >
      <table className="caos-table">
        <caption>{tr(table.caption, es)}</caption>
        <thead>
          <tr>
            <th scope="col">{tr(table.head[0], es)}</th>
            <th scope="col" className="caos-col-text" style={{ minWidth: 0 }}>
              {tr(table.head[1], es)}
            </th>
            <th scope="col" className="caos-col-text" style={{ minWidth: 0 }}>
              {tr(table.head[2], es)}
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row[0][0]}>
              <td>
                <code style={{ overflowWrap: "break-word" }}>
                  {breakable(tr(row[0], es))}
                </code>
              </td>
              <td className="caos-col-text" style={{ minWidth: 0 }}>
                {tr(row[1], es)}
              </td>
              <td className="caos-col-text" style={{ minWidth: 0 }}>
                {tr(row[2], es)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Stage = {
  title: readonly [string, string];
  items: readonly (readonly [string, string])[];
};
// The three stages of docs/data-contract/learned-models.md: what leaves training, what the site serves, what the browser does.
const learnedStages: readonly Stage[] = [
  {
    title: ["Offline export (local)", "Exportación local"],
    items: [
      [
        "Training and checkpoints stay local",
        "Entrenamiento y checkpoints quedan locales",
      ],
      [
        "topology-mlp and graph-surrogate to ONNX",
        "topology-mlp y graph-surrogate a ONNX",
      ],
      [
        "Measured ONNX parity recorded per entry",
        "Concordancia ONNX medida y registrada",
      ],
    ],
  },
  {
    title: [
      "Static assets (/data/models/, /data/ort/)",
      "Activos estáticos (/data/models/, /data/ort/)",
    ],
    items: [
      [
        "Registry: aerovia.model-registry/v1",
        "Registro: aerovia.model-registry/v1",
      ],
      [
        "Signature, base resistances, factor and speed bounds",
        "Firma, resistencias base, límites de factor y velocidad",
      ],
      [
        "ONNX files with SHA-256 and byte count",
        "Archivos ONNX con SHA-256 y bytes",
      ],
      [
        "One WASM runtime (onnxruntime-web)",
        "Un runtime WASM (onnxruntime-web)",
      ],
    ],
  },
  {
    title: ["Browser runtime", "Ejecución en el navegador"],
    items: [
      [
        "Verify checksums before execution",
        "Verificar sumas antes de ejecutar",
      ],
      [
        "Check the domain: reject, never clip",
        "Comprobar dominio: rechazar, nunca recortar",
      ],
      [
        "Flows x speed, pressures x speed squared",
        "Caudales x velocidad, presiones x velocidad al cuadrado",
      ],
      [
        "Status: supported, out-of-domain, unavailable, failed",
        "Estado: soportado, fuera de dominio, ausente, fallido",
      ],
      [
        "Compare with the exact reference solution",
        "Comparar con la solución exacta de referencia",
      ],
    ],
  },
];

/** The architecture of the learned models: the registry, the ONNX models and the browser runtime, drawn from the contract. */
function LearnedArchitecture() {
  const es = useShellLang() === "es";
  const id = useId().replace(/:/g, "");
  const pick = (pair: readonly [string, string]) => pair[es ? 1 : 0];
  const lineHeight = 24;
  const gap = 34;
  let y = 14;
  const boxes = learnedStages.map((stage, index) => {
    const height = 48 + stage.items.length * lineHeight;
    const box = { stage, index, y, height };
    y += height + gap;
    return box;
  });
  const total = y - gap + 14;
  const label = es
    ? "Arquitectura de los modelos aprendidos: exportación local, registro y modelos ONNX estáticos, ejecución en el navegador"
    : "Architecture of the learned models: local export, the registry and static ONNX models, the browser runtime";
  return (
    <svg
      viewBox={`0 0 520 ${total}`}
      role="img"
      aria-label={label}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 560,
        margin: "0 auto",
        fontFamily: "var(--font-sans, sans-serif)",
      }}
    >
      <title>{label}</title>
      <defs>
        <marker
          id={`${id}-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--color-fg-subtle)" />
        </marker>
      </defs>
      {boxes.map(({ stage, index, y: top, height }) => (
        <g key={index}>
          <rect
            x="10"
            y={top}
            width="500"
            height={height}
            rx="6"
            fill="var(--color-surface)"
            stroke={index === 1 ? "var(--color-accent)" : "var(--color-good)"}
            strokeWidth="1.5"
          />
          <text
            x="26"
            y={top + 28}
            fill="var(--color-fg)"
            fontSize="15"
            fontWeight="600"
          >
            {pick(stage.title)}
          </text>
          {stage.items.map((item, row) => (
            <text
              key={row}
              x="26"
              y={top + 54 + row * lineHeight}
              fill="var(--color-fg-subtle)"
              fontSize="13"
            >
              {pick(item)}
            </text>
          ))}
          {index < boxes.length - 1 && (
            <line
              x1="260"
              y1={top + height + 2}
              x2="260"
              y2={top + height + gap - 3}
              stroke="var(--color-fg-subtle)"
              strokeWidth="2"
              markerEnd={`url(#${id}-arrow)`}
            />
          )}
        </g>
      ))}
    </svg>
  );
}

/** The sections of one topic, whole and in order; the contract sections carry their table and the Models topic its architecture figure. */
export function ImplementationTopic({ id }: { id: string }) {
  const es = useShellLang() === "es";
  const topic = implementationTopics.find((t) => t.id === id);
  if (!topic) return null;
  return (
    <>
      {topic.sections.map((sectionId) => {
        const section = implementationSections.find((s) => s.id === sectionId);
        if (!section) return null;
        const table = contractTables[section.id];
        return (
          <DeepSection key={section.id} section={section}>
            {table && <ContractTableView table={table} />}
            {section.id === "learned-pipeline" && (
              <Figure
                caption={
                  es
                    ? "Arquitectura de los modelos aprendidos: el entrenamiento y la exportación ONNX son locales; el sitio sirve el registro y los modelos con sus sumas de verificación, y el navegador comprueba el dominio antes de toda inferencia."
                    : "Architecture of the learned models: training and the ONNX export are local; the site serves the registry and the models with their checksums, and the browser checks the domain before any inference."
                }
              >
                <LearnedArchitecture />
              </Figure>
            )}
          </DeepSection>
        );
      })}
    </>
  );
}

export default function Implementation() {
  const es = useShellLang() === "es";
  return (
    <DocPage
      title={{ en: "Implementation", es: "Implementación" }}
      lede={
        <>
          {es
            ? "La implementación separa validación, motores, preparación científica e interfaz. Esta página documenta algoritmos, constantes, límites y controles necesarios para reproducir un resultado. Desplegar lee evidencia revisada; no entrena modelos ni regenera el benchmark. La identidad de entradas y salidas conserva la trazabilidad de cada cálculo."
            : "The implementation separates user-input validation, numerical engines, scientific preparation and the browser surface. This page documents the actual algorithms, constants, model boundaries and release checks needed to reproduce a result. Deployment reads reviewed evidence; it does not train models or regenerate the benchmark."}{" "}
          <InlineMath tex={String.raw`x\rightarrow f(x)\rightarrow r(x)`} />
        </>
      }
    >
      <DocBody>
        <Figure
          caption={
            es
              ? "Reproducibilidad: entradas, opciones, semillas, versiones y hashes viajan con los resultados. Los tiempos medidos siguen vinculados al hardware registrado."
              : "Reproducibility: inputs, options, seeds, versions and hashes accompany results. Measured timings remain tied to recorded hardware."
          }
        >
          <div className="fig-svg wide">
            <ScienceDiagram kind="pipeline" />
          </div>
        </Figure>
        <TabGroups
          ariaLabel={es ? "Etapas de implementación" : "Implementation stages"}
          groups={implementationGroups.map((group) => ({
            id: group.id,
            label: tr(group.label, es),
            tabs: group.topics.map((topic) => ({
              id: topic.id,
              label: tr(topic.label, es),
              content: <ImplementationTopic id={topic.id} />,
            })),
          }))}
        />
      </DocBody>
    </DocPage>
  );
}
