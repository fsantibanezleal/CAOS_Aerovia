import {
  DocPage,
  ExecutiveView,
  SubTabs,
  Tabs,
  useShellLang,
} from "@fasl-work/caos-app-shell";
import executive from "../../../content/executive.json";
import {
  DeepSection,
  DocBody,
  tr,
  type Bilingual,
} from "../content/primitives";
import {
  introductionSections,
  introductionSteps,
} from "../content/introduction";

/**
 * Introduction (shell 0.15.0, ADR-0017 section 2.1, CAOS_MANAGE conventions/problem-context-first.md): a documentation
 * page with two views. The executive view is first and open on load; it is the shell's ExecutiveView fed by
 * content/executive.json, never composed here. The technical view carries the five areas of the page, one topic each: the
 * problem, the principles, the mathematics, the pipeline and what is exact and what is not. The shell draws one references
 * block at the end of the open topic.
 */
const topicLabels: Record<string, Bilingual> = {
  problem: ["The problem", "El problema"],
  principles: ["Principles", "Principios"],
  math: ["Mathematics", "Matemática"],
  pipeline: ["Pipeline", "Flujo de trabajo"],
  honesty: ["Scope and limits", "Alcance y límites"],
};

/** The five areas of the technical view, in the order of the page. */
export const TOPIC_IDS = introductionSections.map((section) => section.area);

export default function Introduction() {
  return <IntroductionPage data={executive} base={import.meta.env.BASE_URL} />;
}

/** The page for a given data file; the render tests pass their own `base` and may open the technical view on a topic. */
export function IntroductionPage({
  data,
  base,
  initial,
  topic,
}: {
  data: unknown;
  base: string;
  initial?: "executive" | "technical";
  topic?: string;
}) {
  const es = useShellLang() === "es";
  return (
    <DocPage
      title={{ en: "Introduction", es: "Introducción" }}
      lede={
        es
          ? "Aerovia conecta redes subterráneas editables con cálculos de presión, caudal, energía y transporte pasivo. Es una herramienta inspeccionable de planificación y análisis con cálculo local y evidencia reproducible. Sus escenarios creados son supuestos de ingeniería; los métodos numéricos y sus límites permanecen explícitos."
          : "Aerovia connects editable underground networks to pressure, airflow, energy and passive-transport calculations. It is an inspectable planning and analysis instrument with local computation and reproducible evidence. Its authored scenarios are engineering assumptions, while the numerical methods and their limits remain explicit."
      }
    >
      <DocBody>
        <Tabs
          ariaLabel={es ? "Vistas de la introducción" : "Introduction views"}
          initial={initial}
          tabs={[
            {
              id: "executive",
              label: es ? "Ejecutiva" : "Executive",
              content: <ExecutiveView data={data} base={base} />,
            },
            {
              id: "technical",
              label: es ? "Técnica" : "Technical",
              content: <TechnicalView topic={topic} />,
            },
          ]}
        />
      </DocBody>
    </DocPage>
  );
}

function TechnicalView({ topic }: { topic?: string }) {
  const es = useShellLang() === "es";
  return (
    <SubTabs
      orientation="vertical"
      ariaLabel={es ? "Áreas de la vista técnica" : "Technical view areas"}
      initial={topic}
      tabs={introductionSections.map((section) => ({
        id: section.area,
        label: tr(topicLabels[section.area] ?? section.title, es),
        content: (
          <DeepSection section={section}>
            {section.area === "pipeline" && (
              <ol>
                {introductionSteps.map((step) => (
                  <li key={step[0]}>{tr(step, es)}</li>
                ))}
              </ol>
            )}
          </DeepSection>
        ),
      }))}
    />
  );
}
