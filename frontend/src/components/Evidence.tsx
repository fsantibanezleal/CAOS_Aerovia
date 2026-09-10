import { useState } from "react";
import VerificationSummary from "./VerificationSummary";
export default function Evidence({
  lang,
  benchmark,
  caseCount,
}: {
  lang: "en" | "es";
  benchmark: unknown;
  caseCount: number;
}) {
  const b = (en: string, es: string) => (lang === "en" ? en : es);
  const [tab, setTab] = useState("use");
  return (
    <section className="evidence">
      <div className="section-title">
        <span className="eyebrow">
          {b("THE MODEL, MADE INSPECTABLE", "EL MODELO, TRANSPARENTE")}
        </span>
        <h1>
          {b(
            "Know what the numbers mean.",
            "Entienda qué significan los números.",
          )}
        </h1>
        <p>
          {b(
            "A planning instrument with explicit inputs, equations and numerical evidence.",
            "Una herramienta de planificación con entradas, ecuaciones y evidencia numérica explícitas.",
          )}
        </p>
      </div>
      <div className="segmented">
        {[
          ["use", "Use the workbench", "Usar la herramienta"],
          ["physics", "Physics & limits", "Física y límites"],
          ["data", "Your data", "Sus datos"],
          ["verification", "Verification", "Verificación"],
        ].map(([id, en, es]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {b(en, es)}
          </button>
        ))}
      </div>
      <article>
        {tab === "use" && (
          <>
            <h2>
              {b(
                "An intervention, traced through the mine",
                "Una intervención, seguida por toda la mina",
              )}
            </h2>
            <p>
              {b(
                "Choose a case and inspect the intake, working districts and return routes. The authored geometry describes network connectivity; it does not depict a surveyed mine. Click an airway, or choose it from the searchable network list. Its calculated quantities and editable assumptions appear in the inspector.",
                "Seleccione un caso e inspeccione las entradas, distritos de trabajo y retornos. La geometría creada describe la conectividad; no representa una mina levantada. Haga clic en una galería o selecciónela en la lista. El inspector muestra sus resultados y supuestos editables.",
              )}
            </p>
            <ol>
              <li>
                {b(
                  "Save a baseline before an intervention.",
                  "Guarde una referencia antes de intervenir.",
                )}
              </li>
              <li>
                {b(
                  "Change fan speed, branch resistance or regulator setting. A worker recalculates the entire network.",
                  "Cambie la velocidad del ventilador, la resistencia o la regulación. Un proceso en segundo plano recalcula toda la red.",
                )}
              </li>
              <li>
                {b(
                  "Inspect target delivery and spatial flow changes. A closed connection can disconnect a district; that is reported as a model failure, not a successful zero-flow result.",
                  "Inspeccione el cumplimiento de objetivos y los cambios de caudal. Cerrar una conexión puede desconectar un distrito; se informa como fallo del modelo.",
                )}
              </li>
              <li>
                {b(
                  "Use the operating envelope and minimum-speed search to compare feasible settings. Export the project and numerical results for review.",
                  "Use la envolvente operativa y la búsqueda de velocidad mínima para comparar configuraciones factibles. Exporte el proyecto y los resultados para revisión.",
                )}
              </li>
            </ol>
            <h3>{b("Read the scene", "Leer la escena")}</h3>
            <p>
              {b(
                "Tube colors encode the selected quantity. Moving markers show the direction and relative velocity of solved branch flow. These are network encodings, not fluid particles from CFD. Level separation changes the display only; physical coordinates and calculations remain unchanged. Pause motion, switch to a plan view or use the full results table at any time.",
                "Los colores representan la variable elegida. Los marcadores indican la dirección y velocidad relativa del flujo calculado. Son representaciones de red, no partículas de CFD. Separar niveles modifica solo la visualización. Puede pausar, cambiar a planta o usar la tabla de resultados.",
              )}
            </p>
          </>
        )}
        {tab === "physics" && (
          <>
            <h2>
              {b(
                "Pressure drives a conserved network flow",
                "La presión impulsa un flujo conservado",
              )}
            </h2>
            <p>
              {b(
                "Every internal junction conserves volume flow under the constant-density assumption. A branch has a signed turbulent resistance law. Pressure-boundary nodes anchor the system; a quadratic fan supplies head.",
                "Cada unión interna conserva caudal volumétrico bajo el supuesto de densidad constante. Cada rama cumple una ley turbulenta con signo. Los nodos de presión fija anclan el sistema y el ventilador aporta presión.",
              )}
            </p>
            <div className="equation">
              Σ Q = 0<br />
              pᵤ − pᵥ + H₀s² = (R + k) Q |Q|
              <br />P = H(Q,s) Q / (1000 η)
            </div>
            <p>
              {b(
                "Q is m³/s, pressure is Pa, R is Pa·s²/m⁶, s is a normalized speed factor, k is the quadratic fan coefficient and η is the entered efficiency. Electrical power is kW. Resistance is supplied at the assumed operating density. Changing area alone changes velocity Q/A; it does not silently recalibrate the separately entered resistance.",
                "Q se expresa en m³/s, presión en Pa, R en Pa·s²/m⁶, s es la velocidad normalizada, k el coeficiente cuadrático y η la eficiencia ingresada. La potencia eléctrica es kW. Cambiar solo el área modifica la velocidad Q/A; no recalibra la resistencia independiente.",
              )}
            </p>
            <p>
              <a
                href="https://www.srk.com/download/file/594"
                target="_blank"
                rel="noreferrer"
              >
                {b(
                  "McPherson: ventilation networks and fan laws, chapters 5, 7 and 10",
                  "McPherson: redes de ventilación y leyes de ventiladores, capítulos 5, 7 y 10",
                )}
              </a>
            </p>
            <h3>{b("The supported boundary", "Alcance del modelo")}</h3>
            <p>
              {b(
                "This release models steady, isothermal, incompressible network flow with a monotone quadratic fan. It does not calculate mine climate, gas exposure, fire, compressibility, fan stall physics or evacuation. Target values are user-entered planning requirements, not regulatory limits. Numerical verification is not field calibration. Validate survey inputs and operating applicability before professional decisions.",
                "Esta versión modela flujo estacionario, isotérmico e incompresible con ventilador cuadrático monótono. No calcula clima, exposición a gases, incendios, compresibilidad, pérdida aerodinámica ni evacuación. Los objetivos son requisitos de planificación ingresados, no límites normativos. Verificación numérica no equivale a calibración de campo.",
              )}
            </p>
            <h3>
              {b(
                "Optimization and uncertainty",
                "Optimización e incertidumbre",
              )}
            </h3>
            <p>
              {b(
                "Minimum-speed search varies the common fan speed within 0 to 1.5 and checks every signed branch target. It is not global optimization of arbitrary fan and regulator combinations. Sensitivity perturbs one airway resistance by 5%. GPU ensembles vary resistance independently under an explicit lognormal assumption. Percentiles describe that assumed model only. Baked ensembles apply to their original case and settings; edits invalidate the match.",
                "La búsqueda varía la velocidad común entre 0 y 1,5 y comprueba cada objetivo con signo. No es optimización global de ventiladores y reguladores. La sensibilidad modifica una resistencia un 5%. Los conjuntos GPU varían resistencias independientemente con supuesto lognormal. Los percentiles describen ese modelo supuesto. Editar el caso invalida la coincidencia con los resultados precalculados.",
              )}
            </p>
          </>
        )}
        {tab === "data" && (
          <>
            <h2>
              {b(
                "Your network stays on your computer",
                "Su red permanece en su equipo",
              )}
            </h2>
            <p>
              {b(
                "No account, upload endpoint, analytics tracker or API key is needed. JSON imports are parsed and validated locally. A valid network provides node IDs and coordinates, boundary pressures, branch connectivity, areas, positive resistance, optional fan curves and signed forward flow targets. Export a bundled network as a starting contract.",
                "No se requiere cuenta, carga al servidor, seguimiento ni clave API. Los JSON se validan localmente. Una red válida incluye identificadores y coordenadas, presiones de borde, conectividad, áreas, resistencia positiva, curvas de ventilador opcionales y objetivos de flujo hacia adelante. Exporte una red incluida como ejemplo del contrato.",
              )}
            </p>
            <div className="pipeline-diagram">
              {[
                b("Network JSON", "Red JSON"),
                b("Validate", "Validar"),
                b("Solve + evaluate", "Resolver + evaluar"),
                b("Inspect + export", "Inspeccionar + exportar"),
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  <strong>{s}</strong>
                </div>
              ))}
            </div>
            <p>
              {b(
                "The offline Python pipeline accepts the same network contract. CPU processing uses SciPy as an independent reference. CUDA processing runs numerical resistance ensembles with PyTorch, checks residuals, compares a subset with the CPU reference and exports compact checksummed artifacts. Hosting publishes those artifacts; it never generates scientific results during deployment.",
                "La cadena Python acepta el mismo contrato. El procesamiento CPU usa SciPy como referencia independiente. CUDA ejecuta conjuntos numéricos con PyTorch, verifica residuos, compara una muestra con CPU y exporta artefactos con sumas de verificación. El despliegue publica esos artefactos sin generar resultados científicos.",
              )}
            </p>
            <p>
              {b(
                "Browser projects are saved on this device. Export a project to move or back it up. Browser storage can be cleared by the browser or device owner; a downloaded project is your portable copy. Imported project settings are validated before use.",
                "Los proyectos se guardan en este dispositivo. Expórtelos para trasladarlos o respaldarlos. El navegador o su propietario puede borrar el almacenamiento; la descarga es su copia portátil. Las configuraciones importadas se validan antes de usarlas.",
              )}
            </p>
          </>
        )}
        {tab === "verification" && (
          <>
            <h2>{b("Evidence you can reproduce", "Evidencia reproducible")}</h2>
            <p>
              {b(
                `${caseCount} authored networks are processed through the canonical offline pipeline. Analytical fixtures test known answers; independent SciPy and browser engines test agreement; CPU/GPU comparisons test the batch implementation. A converged status requires both junction conservation and branch pressure closure.`,
                `${caseCount} redes creadas se procesan mediante la cadena canónica. Casos analíticos comprueban respuestas conocidas; SciPy y el navegador comprueban concordancia; CPU/GPU comprueban el cálculo por lotes. La convergencia exige conservación y cierre de presión.`,
              )}
            </p>
            <VerificationSummary
              benchmark={benchmark}
              caseCount={caseCount}
              lang={lang}
            />
            <details>
              <summary>
                {b(
                  "Inspect the raw validation record",
                  "Inspeccionar el registro original de validación",
                )}
              </summary>
              <pre>{JSON.stringify(benchmark ?? {}, null, 2)}</pre>
            </details>
            <p>
              {b(
                "Source code, automated tests, manifests and reproduction instructions are available in the public repository. Performance and agreement measurements describe these input sizes and this model, not industrial certification.",
                "El código, las pruebas, los manifiestos y las instrucciones están en el repositorio público. Las mediciones describen estos tamaños y este modelo; no constituyen certificación industrial.",
              )}
            </p>
            <p>
              <a
                href="https://github.com/fsantibanezleal/CAOS_Aerovia"
                target="_blank"
                rel="noreferrer"
              >
                {b(
                  "Open source and reproduction guides",
                  "Código abierto y guías de reproducción",
                )}
              </a>
            </p>
          </>
        )}
      </article>
    </section>
  );
}
