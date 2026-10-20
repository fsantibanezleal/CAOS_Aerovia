import { InlineMath, SubTabs, useShellLang } from "@fasl-work/caos-app-shell";
import { DeepSection, PageHeading, tr } from "../content/primitives";
import { implementationSections } from "../content/implementation";
import ScienceDiagram from "../content/ScienceDiagram";

// The shell reports more than six peer tabs (ADR-0071 rule 5, enforced since 0.7.0), and the eight stages were eight
// peers. Four of them are read in pairs: the inputs with their geometry, the two solvers side by side. Every section is
// still shown, whole, in the order it had.
const stageTabs: { id: string; sections: string[]; label: readonly [string, string] }[] = [
  { id: "inputs", sections: ["ingestion", "geometry"], label: ["Inputs and geometry", "Entradas y geometría"] },
  { id: "solvers", sections: ["browser-engine", "reference-engine"], label: ["Solvers", "Solucionadores"] },
  { id: "cuda-ensemble", sections: ["cuda-ensemble"], label: ["CUDA batches", "Lotes CUDA"] },
  { id: "learned-pipeline", sections: ["learned-pipeline"], label: ["Models", "Modelos"] },
  { id: "transport-engine", sections: ["transport-engine"], label: ["Transport", "Transporte"] },
  { id: "release-runtime", sections: ["release-runtime"], label: ["Deployment", "Despliegue"] },
];

export default function Implementation() {
  const es = useShellLang() === "es";
  return (
    <div className="page-body prose av-doc-scroll">
      <PageHeading
        title={["Implementation", "Implementación"]}
        lede={[
          "The implementation separates user-input validation, numerical engines, scientific preparation and the browser surface. This page documents the actual algorithms, constants, model boundaries and release checks needed to reproduce a result. Deployment reads reviewed evidence; it does not train models or regenerate the benchmark.",
          "La implementación separa validación, motores, preparación científica e interfaz. Esta página documenta algoritmos, constantes, límites y controles necesarios para reproducir un resultado. Desplegar lee evidencia revisada; no entrena modelos ni regenera el benchmark. La identidad de entradas y salidas conserva la trazabilidad de cada cálculo.",
        ]}
      >
        <InlineMath tex={String.raw`x\rightarrow f(x)\rightarrow r(x)`} />
      </PageHeading>
      <figure className="fig-svg wide">
        <ScienceDiagram kind="pipeline" />
        <figcaption>
          {es
            ? "Reproducibilidad: entradas, opciones, semillas, versiones y hashes viajan con los resultados. Los tiempos medidos siguen vinculados al hardware registrado."
            : "Reproducibility: inputs, options, seeds, versions and hashes accompany results. Measured timings remain tied to recorded hardware."}
        </figcaption>
      </figure>
      <SubTabs
        orientation="vertical"
        ariaLabel={es ? "Etapas de implementación" : "Implementation stages"}
        tabs={stageTabs.map((stage) => ({
          id: stage.id,
          label: tr(stage.label, es),
          content: (
            <>
              {stage.sections.map((id) => {
                const section = implementationSections.find((s) => s.id === id);
                return section ? <DeepSection key={id} section={section} /> : null;
              })}
            </>
          ),
        }))}
      />
    </div>
  );
}
