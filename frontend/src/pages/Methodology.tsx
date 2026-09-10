import { InlineMath, SubTabs, useShellLang } from "@fasl-work/caos-app-shell";
import { DeepSection, PageHeading, tr } from "../content/primitives";
import { classicalMethods } from "../content/methods";
import { learnedMethods } from "../content/learned-methods";

const tabLabels: Record<string, readonly [string, string]> = {
  "pressure-flow": ["Pressure and flow", "Presión y caudal"],
  "fan-control": ["Fan control", "Control de ventilador"],
  "resistance-uncertainty": ["Uncertainty", "Incertidumbre"],
  "passive-transport": ["Tracer and routes", "Trazador y rutas"],
  "topology-mlp": ["Topology MLP", "MLP de topología"],
  "graph-surrogate": ["Graph surrogate", "Modelo de grafos"],
};

export default function Methodology() {
  const es = useShellLang() === "es";
  return (
    <div className="page-body prose av-doc-scroll">
      <PageHeading
        title={["Methodology", "Metodología"]}
        lede={[
          "Each method answers a distinct question: pressure balance, feasible fan operation, conditional resistance uncertainty, passive transport, or approximation by a trained response model. The equations, numerical choices, assumptions and failure states below define what each result means and which comparisons are scientifically justified.",
          "Cada método responde una pregunta: equilibrio de presión, operación factible del ventilador, incertidumbre condicional de resistencia, transporte pasivo o aproximación por modelo entrenado. Las ecuaciones, decisiones numéricas, supuestos y fallos definen qué significa cada resultado y qué comparaciones se justifican científicamente.",
        ]}
      >
        <InlineMath tex={String.raw`B_IQ=0`} />
      </PageHeading>
      <SubTabs
        orientation="vertical"
        ariaLabel={es ? "Familias de métodos" : "Method families"}
        tabs={[...classicalMethods, ...learnedMethods].map((section) => ({
          id: section.id,
          label: tr(tabLabels[section.id] ?? section.title, es),
          content: <DeepSection section={section} />,
        }))}
      />
    </div>
  );
}
