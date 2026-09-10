import { InlineMath, SubTabs, useShellLang } from "@fasl-work/caos-app-shell";
import { DeepSection, PageHeading, tr } from "../content/primitives";
import { implementationSections } from "../content/implementation";
import ScienceDiagram from "../content/ScienceDiagram";

const tabLabels: Record<string, readonly [string, string]> = {
  ingestion: ["Inputs", "Entradas"],
  geometry: ["Geometry", "Geometría"],
  "browser-engine": ["Browser solver", "Solucionador web"],
  "reference-engine": ["Reference", "Referencia"],
  "cuda-ensemble": ["CUDA batches", "Lotes CUDA"],
  "learned-pipeline": ["Models", "Modelos"],
  "transport-engine": ["Transport", "Transporte"],
  "release-runtime": ["Deployment", "Despliegue"],
};

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
        tabs={implementationSections.map((section) => ({
          id: section.id,
          label: tr(tabLabels[section.id] ?? section.title, es),
          content: <DeepSection section={section} />,
        }))}
      />
    </div>
  );
}
