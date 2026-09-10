import {
  Callout,
  Cite,
  Equation,
  Refs,
  useShellLang,
} from "@fasl-work/caos-app-shell";
import type { Network } from "../contracts";
import { caseQuestions, regimeDefinitions } from "./cases";
import { tr } from "./primitives";

export default function CaseContext({ network }: { network: Network }) {
  const es = useShellLang() === "es";
  const lang = es ? "es" : "en";
  const detail = caseQuestions[network.id];
  return (
    <article className="prose">
      <h2>{network.name[lang]}</h2>
      <section>
        <h3>{es ? "El problema" : "The problem"}</h3>
        <p>{detail ? tr(detail.question, es) : network.description[lang]}</p>
        <p>
          {detail ? tr(detail.design, es) : network.description[lang]}{" "}
          <Cite id="mcpherson1993" />
        </p>
        <Refs
          ids={["mcpherson1993"]}
          label={es ? "Referencias" : "References"}
        />
      </section>
      <section>
        <h3>{es ? "Componentes y variables" : "Components and variables"}</h3>
        <p>
          {es ? "La red contiene" : "The network contains"}{" "}
          {network.nodes.length} {es ? "uniones y" : "junctions and"}{" "}
          {network.edges.length}{" "}
          {es
            ? "galerías. Presión en Pa, caudal en m³/s, área en m² y coordenadas en metros. Velocidad, resistencia y objetivo son entradas distintas."
            : "airways. Pressure is in Pa, flow in m³/s, area in m² and coordinates in meters. Speed, resistance and target are distinct inputs."}
        </p>
        <Refs
          ids={["mcpherson1993"]}
          label={es ? "Referencias" : "References"}
        />
      </section>
      <section>
        <h3>{es ? "Formalización" : "Formalization"}</h3>
        <Equation
          tex={String.raw`B_IQ=0,\quad\Delta p+H_0s^2-(R+k)Q|Q|=0,\quad u=Q/A`}
          caption={
            es
              ? "B_I es incidencia interna; Q caudal; Δp diferencia de presión; H₀,k curva del ventilador; s velocidad común; R resistencia; A área; u velocidad media."
              : "B_I is internal incidence; Q is flow; Δp pressure difference; H₀,k fan curve; s common speed; R resistance; A area; u mean velocity."
          }
        />
        <Refs
          ids={["mcpherson1993", "scipytrf"]}
          label={es ? "Referencias" : "References"}
        />
      </section>
      <section>
        <h3>{es ? "Alcance y supuestos" : "Scope and assumptions"}</h3>
        <Callout
          variant="honest"
          title={es ? "Procedencia del caso" : "Case provenance"}
        >
          <p>
            {network.provenance.kind === "authored"
              ? es
                ? "Escenario de ingeniería creado; sin levantamiento ni calibración de mina real. Los objetivos son hipótesis de diseño."
                : "Authored engineering scenario; no operating-mine survey or calibration. Targets are design assumptions."
              : es
                ? "Datos importados: su calidad y licencia dependen de la fuente suministrada."
                : "Imported data: quality and license depend on the supplied source."}
          </p>
          <p>
            {es
              ? "Modelo estacionario de densidad constante. El transporte es trazador pasivo por celdas; no CFD, incendio ni aprobación de seguridad."
              : "Steady constant-density model. Transport is cell-based passive tracer; no CFD, fire or safety approval."}
          </p>
        </Callout>
        <Refs
          ids={["nioshmfire", "nistcontam"]}
          label={es ? "Referencias" : "References"}
        />
      </section>
      <section>
        <h3>{es ? "Qué muestra cada régimen" : "What each regime shows"}</h3>
        <table>
          <thead>
            <tr>
              <th>{es ? "Régimen" : "Regime"}</th>
              <th>{es ? "Cambio exacto" : "Exact change"}</th>
              <th>{es ? "Pregunta" : "Question"}</th>
            </tr>
          </thead>
          <tbody>
            {regimeDefinitions.map((r) => (
              <tr key={r.id}>
                <th scope="row">{tr(r.name, es)}</th>
                <td>{tr(r.recipe, es)}</td>
                <td>{tr(r.purpose, es)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Refs
          ids={["mcpherson1993"]}
          label={es ? "Referencias" : "References"}
        />
      </section>
      <section>
        <h3>
          {es
            ? "Cómo leer y usar la visualización"
            : "How to read and use the visualization"}
        </h3>
        <p>
          {detail
            ? tr(detail.interpretation, es)
            : es
              ? "Seleccione una galería, guarde referencia y cambie un parámetro físico. Revise convergencia, caudal con signo y déficit antes de interpretar colores o rutas."
              : "Select an airway, save a baseline and change one physical parameter. Inspect convergence, signed flow and deficit before interpreting colors or routes."}
        </p>
        <p>
          {es
            ? "Compare el mismo objeto entre escena, lecturas y gráficos. Para transporte, seleccione tiempo calculado y revise concentración junto con masa almacenada y escapada."
            : "Compare the same object across scene, readouts and charts. For transport, select a calculated time and inspect concentration together with stored and escaped mass."}
        </p>
        <Refs
          ids={["mcpherson1993", "clawpackadvection"]}
          label={es ? "Referencias" : "References"}
        />
      </section>
    </article>
  );
}
