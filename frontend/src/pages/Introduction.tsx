import { InlineMath, useShellLang } from "@fasl-work/caos-app-shell";
import { DeepSection, PageHeading } from "../content/primitives";
import { introductionSections } from "../content/introduction";

export default function Introduction() {
  const es = useShellLang() === "es";
  return (
    <div className="page-body prose av-doc-scroll">
      <PageHeading
        title={["Introduction", "Introducción"]}
        lede={[
          "Aerovia connects editable underground networks to pressure, airflow, energy and passive-transport calculations. It is an inspectable planning and analysis instrument with local computation and reproducible evidence. Its authored scenarios are engineering assumptions, while the numerical methods and their limits remain explicit.",
          "Aerovia conecta redes subterráneas editables con cálculos de presión, caudal, energía y transporte pasivo. Es una herramienta inspeccionable de planificación y análisis con cálculo local y evidencia reproducible. Sus escenarios creados son supuestos de ingeniería; los métodos numéricos y sus límites permanecen explícitos.",
        ]}
      >
        <InlineMath tex={String.raw`\Delta p=RQ|Q|`} />
      </PageHeading>
      {introductionSections.map((section) => (
        <DeepSection key={section.id} section={section}>
          {section.id === "end-to-end" && (
            <ol>
              {(es
                ? [
                    "Definir la decisión, el distrito y el objetivo de caudal.",
                    "Cargar o construir la red y verificar unidades, geometría y conexiones.",
                    "Guardar una referencia y cambiar una hipótesis física identificable.",
                    "Resolver presión y caudal; revisar convergencia y déficit por separado.",
                    "Inspeccionar energía, rutas y transporte con sus respectivos supuestos.",
                    "Comparar con la referencia y exportar proyecto, parámetros y resultados.",
                  ]
                : [
                    "Define the decision, district and delivery target.",
                    "Load or build the network and check units, geometry and connections.",
                    "Save a baseline and change an identifiable physical assumption.",
                    "Solve pressure and flow; inspect convergence and deficit separately.",
                    "Inspect energy, routes and transport with their own assumptions.",
                    "Compare to the baseline and export project, parameters and results.",
                  ]
              ).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </DeepSection>
      ))}
    </div>
  );
}
