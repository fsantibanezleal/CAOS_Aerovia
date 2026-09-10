import type { ScientificSection } from "./primitives";

export const introductionSections: ScientificSection[] = [
  {
    id: "industrial-question",
    title: [
      "The industrial question: where does the supplied air go?",
      "La pregunta industrial: ¿adónde llega el aire suministrado?",
    ],
    paragraphs: [
      [
        "An underground ventilation circuit is shared infrastructure. A surface fan supplies pressure, intake shafts distribute air, production and development openings consume part of the available pressure, and return shafts carry the combined flow out. Regulators, stoppings, crosscuts and auxiliary ducts change this distribution. Increasing total fan flow does not establish that a particular face receives its entered requirement. A low-resistance bypass can carry a disproportionate share while a difficult district remains short. The useful engineering question is therefore spatial and relational: which connection controls delivery, who benefits from changing it, and where does the additional pressure become useful flow?",
        "Un circuito de ventilación subterránea es infraestructura compartida. Un ventilador superficial aporta presión, los piques de admisión distribuyen aire, las labores de producción y desarrollo consumen parte de la presión disponible y los retornos extraen el caudal combinado. Reguladores, sellos, cruceros y ductos auxiliares modifican esa distribución. Aumentar el caudal total no demuestra que una frente reciba su requerimiento ingresado. Un desvío de baja resistencia puede transportar una fracción desproporcionada mientras un distrito difícil sigue deficitario. La pregunta útil es espacial y relacional: qué conexión controla la entrega, quién se beneficia al cambiarla y dónde la presión adicional se convierte en caudal útil.",
      ],
      [
        "Aerovia treats the mine as an editable network of junctions and airways. Each airway carries its own resistance, area, direction convention, target and optional fan curve. The same network supports a pressure solution, velocity interpretation, equipment intervention, route inspection and passive-tracer experiment. This shared representation matters: a change must propagate to the quantities it actually affects. Closing a connection changes topology; changing resistance changes the pressure-flow distribution; changing area alone changes velocity and represented transport volume. None of these operations should be reduced to changing the color of a picture.",
        "Aerovia trata la mina como una red editable de uniones y galerías. Cada galería tiene resistencia, área, convención de dirección, objetivo y curva de ventilador opcional. La misma red sostiene una solución de presión, interpretación de velocidad, intervención de equipos, inspección de rutas y experimento de trazador pasivo. Compartir esta representación importa: un cambio debe propagarse a las magnitudes que realmente afecta. Cerrar una conexión modifica la topología; cambiar la resistencia modifica la distribución de presión y caudal; cambiar solo el área modifica la velocidad y el volumen representado en transporte. Ninguna operación se reduce a cambiar el color de una imagen.",
      ],
      [
        "The authored case library spans shared production shafts, asymmetric districts, gridded workings, leakage interventions, return restrictions, development ducts and a booster arrangement. These are distinct engineering questions, not different random seeds attached to the same scene. Paired cases preserve unaffected assumptions so that a sealing or restriction comparison has a clear causal interpretation within the model. An imported network can replace these authored assumptions. Its quality still depends on meaningful connectivity, consistent units, defensible resistance values and an appropriate fan operating range.",
        "La biblioteca de casos creados abarca piques de producción compartidos, distritos asimétricos, labores reticuladas, intervenciones de fugas, restricciones de retorno, ductos de desarrollo y una configuración con ventilador auxiliar en serie. Son preguntas de ingeniería distintas, no semillas aleatorias diferentes sobre la misma escena. Los casos pareados conservan los supuestos no intervenidos para que comparar sellado o restricción tenga una interpretación causal clara dentro del modelo. Una red importada puede sustituir estos supuestos. Su calidad sigue dependiendo de conectividad significativa, unidades coherentes, resistencias defendibles y un intervalo operativo apropiado del ventilador.",
      ],
      [
        "A productive session begins with a specific decision. Identify the district and its target, save the current network as a comparison, change one physical assumption, and inspect both the local response and the consequences elsewhere. Use the numerical tables when a three-dimensional arrangement hides an edge. Use an airflow route to explain connectivity, and a time-dependent tracer calculation to investigate modeled delay and mixing. A convincing intervention is supported by the input change, the calculated response and the assumptions together; an attractive frame by itself does not establish engineering value.",
        "Una sesión productiva comienza con una decisión concreta. Identifique el distrito y su objetivo, guarde la red actual como comparación, cambie un supuesto físico e inspeccione tanto la respuesta local como las consecuencias en otros sectores. Use las tablas numéricas cuando la disposición tridimensional oculte una rama. Use una ruta de aire para explicar conectividad y un cálculo temporal de trazador para investigar retardo y mezcla modelados. Una intervención convincente reúne el cambio de entrada, la respuesta calculada y los supuestos; una imagen atractiva por sí sola no establece valor de ingeniería.",
      ],
    ],
    equations: [
      {
        tex: String.raw`q_{\mathrm{deficit},e}=\max(0,q_{\mathrm{target},e}-Q_e)`,
        caption: [
          "The forward-flow deficit compares the entered target q_target,e and signed calculated airway flow Q_e, both in m³/s.",
          "El déficit de caudal positivo compara el objetivo ingresado q_target,e y el caudal calculado con signo Q_e, ambos en m³/s.",
        ],
      },
    ],
    assumption: [
      "Targets are supplied design inputs. They are not statutory requirements or a certification of a safe working atmosphere.",
      "Los objetivos son entradas de diseño suministradas. No son exigencias normativas ni una certificación de atmósfera de trabajo segura.",
    ],
    refs: ["mcpherson1993", "nioshmfire"],
    diagram: "network",
    diagramCaption: [
      "The schematic exposes how two districts share the same pressure source and return path.",
      "El esquema muestra cómo dos distritos comparten la misma fuente de presión y retorno.",
    ],
  },
  {
    id: "physical-scope",
    title: [
      "A steady network model with explicit physical scope",
      "Un modelo estacionario de red con alcance físico explícito",
    ],
    paragraphs: [
      [
        "The pressure solver represents a steady, isothermal, constant-density network. At an internal junction, volume flow entering equals volume flow leaving. Along an open airway, a signed quadratic loss balances the pressure difference and any fan pressure source. This is a reduced engineering model: the unknowns are one pressure per junction and one volume flow per airway. It does not resolve a velocity profile across a tunnel, turbulence structures around a loader, or the local plume downstream of an obstruction. Those questions require additional spatial and physical information.",
        "El solucionador de presión representa una red estacionaria, isotérmica y de densidad constante. En una unión interna, el caudal entrante iguala al saliente. En una galería abierta, una pérdida cuadrática con signo equilibra la diferencia de presión y cualquier fuente de presión de ventilador. Es un modelo reducido de ingeniería: las incógnitas son una presión por unión y un caudal por galería. No resuelve el perfil de velocidad de un túnel, estructuras turbulentas alrededor de un cargador ni la pluma local detrás de una obstrucción. Esas preguntas requieren información espacial y física adicional.",
      ],
      [
        "Resistance is an input at the assumed operating density. Its units encode the relation between pressure and squared volume flow. Although the Atkinson formulation relates resistance to friction, perimeter, length and area, the workbench keeps supplied resistance and area independent. This protects against inventing a friction factor from a visual shape. Moving a junction changes the represented geometry; it does not claim that a newly estimated excavation has a calibrated aerodynamic resistance. When an actual design changes section or length, revise the corresponding resistance using the engineering basis appropriate to that design.",
        "La resistencia es una entrada a la densidad operativa supuesta. Sus unidades expresan la relación entre presión y caudal al cuadrado. Aunque la formulación de Atkinson vincula resistencia con fricción, perímetro, longitud y área, la herramienta mantiene independientes resistencia y área suministradas. Esto evita inventar un factor de fricción a partir de una forma visual. Mover una unión cambia la geometría representada; no afirma que una excavación nueva tenga resistencia aerodinámica calibrada. Si un diseño real cambia sección o longitud, revise la resistencia correspondiente usando la base de ingeniería apropiada.",
      ],
      [
        "The directed graph establishes signs rather than forcing the air to obey the drawing. A passive branch may carry negative flow. Pressure boundaries anchor the solution, and each active connected component must reach one of those boundaries. A closure that leaves isolated unknown pressures is a rejected calculation, not a district silently assigned atmospheric pressure. Fans have a narrower supported domain: a reverse-running or negative-delivered-head solution is reported as unsupported. This distinction is essential when interpreting maintenance closures or interacting fan arrangements.",
        "El grafo dirigido establece signos, no obliga al aire a seguir el dibujo. Una rama pasiva puede tener caudal negativo. Las presiones de borde anclan la solución y cada componente activa debe alcanzar una de ellas. Un cierre que deje presiones desconocidas aisladas produce un cálculo rechazado, no un distrito al que se asigna silenciosamente presión atmosférica. Los ventiladores tienen un dominio soportado más estrecho: una solución en reversa o con presión entregada negativa se informa como no soportada. La distinción es esencial al interpretar cierres de mantenimiento o ventiladores que interactúan.",
      ],
      [
        "Time-dependent passive transport uses the steady solution as its velocity field. The airflow can change at specified events, but each event is another quasi-steady network solution. The transport calculation tracks material moving through represented airway volumes and mixing at junctions; it does not add heat release, buoyancy, chemical reaction or ventilation inertia. Reading a concentration animation requires keeping that model hierarchy in mind. The animation is a numerical representation of a defined transport calculation, while its visual rendering is only one way of inspecting the underlying cell values and mass balance.",
        "El transporte pasivo temporal utiliza la solución estacionaria como campo de velocidades. El caudal puede cambiar en eventos especificados, pero cada evento es otra solución cuasiestacionaria de red. El cálculo sigue material que atraviesa volúmenes de galerías representados y se mezcla en uniones; no agrega calor liberado, flotabilidad, reacción química ni inercia de ventilación. Leer una animación de concentración requiere mantener presente esa jerarquía. La animación representa numéricamente un cálculo definido, mientras su dibujo es solo una forma de inspeccionar valores de celdas y balance de masa.",
      ],
    ],
    equations: [
      {
        tex: String.raw`p_u-p_v+H_0s^2-(R_e+k_e)Q_e|Q_e|=0`,
        caption: [
          "Airway balance: p_u and p_v are endpoint pressures (Pa); H₀ is nominal shutoff fan pressure (Pa); s is relative speed; R_e and k_e are airway and fan coefficients (Pa·s²/m⁶); Q_e is signed volume flow (m³/s).",
          "Balance de galería: p_u y p_v son presiones extremas (Pa); H₀ es presión nominal de cierre del ventilador (Pa); s es velocidad relativa; R_e y k_e son coeficientes de galería y ventilador (Pa·s²/m⁶); Q_e es caudal con signo (m³/s).",
        ],
      },
    ],
    assumption: [
      "The calculation does not include compressibility, natural ventilation pressure, combustion, toxic exposure limits or mechanical fan dynamics. A modeled concentration is not a safe-entry decision.",
      "El cálculo no incluye compresibilidad, presión de ventilación natural, combustión, límites de exposición tóxica ni dinámica mecánica del ventilador. Una concentración modelada no decide un ingreso seguro.",
    ],
    refs: ["mcpherson1993", "nioshmfire"],
  },
  {
    id: "mathematical-language",
    title: [
      "The mathematical language and its units",
      "El lenguaje matemático y sus unidades",
    ],
    paragraphs: [
      [
        "Let the incidence matrix place +1 at the source of an airway and −1 at its destination. Retaining only rows for internal junctions gives a compact conservation equation. Each pressure boundary removes an otherwise undetermined pressure degree of freedom. The pressure solver evaluates all airway flows from candidate nodal pressures and drives their internal imbalances to zero. An independent reference instead solves for flows and pressures together. Agreement between those implementations is useful because their unknowns, initialization and nonlinear strategies differ even though the physical problem is identical.",
        "La matriz de incidencia coloca +1 en el origen de una galería y −1 en su destino. Al conservar solo las filas de uniones internas se obtiene una ecuación compacta de conservación. Cada presión de borde elimina un grado de libertad de presión que de otro modo quedaría indeterminado. El solucionador calcula todos los caudales a partir de presiones candidatas y lleva a cero sus desequilibrios internos. Una referencia independiente resuelve simultáneamente caudales y presiones. Comparar ambas implementaciones es útil porque difieren incógnitas, inicialización y estrategia no lineal, aunque el problema físico sea idéntico.",
      ],
      [
        "Two residuals answer different questions. The mass residual measures the largest internal volume-flow imbalance, in cubic meters per second. The pressure residual measures the largest airway equation mismatch, in pascals. They cannot be meaningfully added without scaling, and neither is a percentage accuracy against a real mine. Solver acceptance requires both absolute thresholds as well as a supported fan state. A result that meets conservation can still miss an entered delivery target; an infeasible target and a failed numerical solve are separate outcomes.",
        "Dos residuos responden preguntas diferentes. El residuo de masa mide el mayor desequilibrio interno de caudal volumétrico, en metros cúbicos por segundo. El residuo de presión mide el mayor desajuste de la ecuación de galería, en pascales. No pueden sumarse significativamente sin escalamiento y ninguno es un porcentaje de exactitud frente a una mina real. Aceptar una solución requiere ambos umbrales absolutos y un estado soportado del ventilador. Un resultado conservativo todavía puede incumplir un objetivo; un objetivo inviable y un fallo numérico son resultados distintos.",
      ],
      [
        "Power provides a second physical connection between the spatial network and a decision. Delivered fan pressure multiplied by forward flow is air power. Dividing by entered efficiency gives the electrical demand represented by the model, with a factor of one thousand converting watts to kilowatts. Operating hours turn that demand into scenario energy. A tariff then turns energy into cost in the tariff’s chosen currency. The comparison must preserve the same efficiency, hours and tariff assumptions unless changing one of them is the intervention being studied.",
        "La potencia aporta una segunda conexión física entre la red espacial y una decisión. La presión entregada por el ventilador multiplicada por el caudal positivo es potencia al aire. Dividir por eficiencia ingresada entrega la demanda eléctrica representada, con un factor de mil para convertir vatios a kilovatios. Las horas de operación convierten demanda en energía del escenario. Una tarifa convierte energía en costo en la moneda elegida. La comparación debe conservar los mismos supuestos de eficiencia, horas y tarifa salvo que cambiar uno de ellos sea la intervención estudiada.",
      ],
    ],
    equations: [
      {
        tex: String.raw`B_I Q=0,\qquad r_m=\|B_IQ\|_\infty`,
        caption: [
          "B_I is the internal-junction incidence matrix; Q is the airway-flow vector; r_m is maximum absolute internal imbalance (m³/s).",
          "B_I es la matriz de incidencia de uniones internas; Q es el vector de caudales; r_m es el desequilibrio interno absoluto máximo (m³/s).",
        ],
      },
      {
        tex: String.raw`P_{\mathrm{el}}=\sum_{e\in F}\frac{\max(H_e,0)\max(Q_e,0)}{1000\eta_e},\qquad E=P_{\mathrm{el}}t_h`,
        caption: [
          "P_el is modeled electrical demand (kW); F is the fan set; H_e is delivered pressure (Pa); η_e is entered efficiency; t_h is operating time (h); E is energy (kWh).",
          "P_el es demanda eléctrica modelada (kW); F es el conjunto de ventiladores; H_e es presión entregada (Pa); η_e es eficiencia ingresada; t_h es tiempo operativo (h); E es energía (kWh).",
        ],
      },
    ],
    symbols: [
      [
        "Q: signed airway volume flow, m³/s.",
        "Q: caudal volumétrico con signo, m³/s.",
      ],
      ["p: junction pressure, Pa.", "p: presión de unión, Pa."],
      [
        "R: supplied operating-density resistance, Pa·s²/m⁶.",
        "R: resistencia a densidad operativa suministrada, Pa·s²/m⁶.",
      ],
      [
        "A: airway cross-sectional area, m².",
        "A: área transversal de galería, m².",
      ],
      [
        "L: represented centerline length, m.",
        "L: longitud de eje representada, m.",
      ],
      [
        "u=|Q|/A: mean speed magnitude, m/s.",
        "u=|Q|/A: magnitud de velocidad media, m/s.",
      ],
      [
        "s: fan speed divided by nominal speed, dimensionless.",
        "s: velocidad de ventilador dividida por la nominal, adimensional.",
      ],
      [
        "H₀: nominal shutoff pressure, Pa.",
        "H₀: presión nominal a caudal nulo, Pa.",
      ],
      [
        "k: quadratic fan-curve coefficient, Pa·s²/m⁶.",
        "k: coeficiente cuadrático de curva del ventilador, Pa·s²/m⁶.",
      ],
      [
        "η: entered fan-system efficiency, dimensionless.",
        "η: eficiencia ingresada del sistema ventilador, adimensional.",
      ],
      [
        "C: passive tracer mass concentration, mg/m³.",
        "C: concentración másica de trazador pasivo, mg/m³.",
      ],
      [
        "V: represented transport-cell volume, m³.",
        "V: volumen representado de celda de transporte, m³.",
      ],
    ],
    assumption: [
      "SI units are part of the data contract. A coordinate unit error can leave the pressure calculation unchanged while changing transit times drastically, because supplied resistance and geometric volume are distinct inputs.",
      "Las unidades SI son parte del contrato. Un error de unidades de coordenadas puede no cambiar el cálculo de presión y alterar drásticamente los tiempos de tránsito, porque resistencia y volumen geométrico son entradas distintas.",
    ],
    refs: ["mcpherson1993", "scipytrf"],
  },
  {
    id: "end-to-end",
    title: [
      "From a design question to an inspectable result",
      "De una pregunta de diseño a un resultado inspeccionable",
    ],
    paragraphs: [
      [
        "The input stage establishes identifiers, coordinates, pressure boundaries and airway connectivity before solving anything. Each edge must refer to existing nodes, have finite positive resistance and area, and use a consistent direction convention. A project also retains the active physical controls and a saved comparison. Import validation must finish before replacing the current project: malformed input should explain the failing condition while preserving usable work. The browser runs local computation on the accepted network; it does not require a visitor account or a remote engineering database.",
        "La entrada establece identificadores, coordenadas, presiones de borde y conectividad antes de calcular. Cada rama debe referenciar nodos existentes, tener resistencia y área finitas positivas y una dirección coherente. Un proyecto conserva además controles físicos activos y comparación guardada. La validación debe terminar antes de reemplazar el proyecto: una entrada inválida debe explicar la condición fallida y preservar el trabajo útil. El navegador calcula localmente sobre la red aceptada; no requiere cuenta de visitante ni base remota de ingeniería.",
      ],
      [
        "The independent offline pipeline provides the reproducible numerical record. It recreates or acquires inputs, validates them, solves the reference equations, computes requested uncertainty batches and checks the outputs before publication. Learned response models have additional responsibilities: explicit train and held-out partitions, recorded normalization, actual trained weights and comparison to the same numerical reference. A model filename is not training evidence. The live browser implementation must also demonstrate parity with its exported model rather than assuming that a successful download establishes equivalent inference.",
        "La cadena local independiente aporta el registro numérico reproducible. Recrea o adquiere entradas, las valida, resuelve ecuaciones de referencia, calcula lotes de incertidumbre pedidos y verifica salidas antes de publicar. Los modelos aprendidos tienen responsabilidades adicionales: particiones explícitas de entrenamiento y prueba, normalización registrada, pesos realmente entrenados y comparación con la misma referencia numérica. Un nombre de archivo no prueba entrenamiento. La implementación del navegador también debe demostrar concordancia con su modelo exportado; una descarga exitosa no establece inferencia equivalente.",
      ],
      [
        "The companion interface connects these calculations to inspection. Selecting a district or airway should identify the same physical object across geometry, numerical readouts and comparisons. A baseline is an explicit saved state, not an arbitrary visually pleasing target. Replay evidence belongs to its recorded network and options; editing the active design must not quietly reuse an old uncertainty band. The user can export a project to continue locally and export numerical results to review outside the interface. Reproducibility depends on keeping the assumptions with those numbers.",
        "La interfaz complementaria conecta cálculos con inspección. Seleccionar distrito o galería debe identificar el mismo objeto físico entre geometría, lecturas y comparaciones. Una referencia es un estado guardado explícito, no un objetivo visual arbitrario. La evidencia precalculada pertenece a su red y opciones registradas; editar el diseño activo no debe reutilizar silenciosamente una banda vieja de incertidumbre. Se puede exportar un proyecto para continuar localmente y resultados para revisarlos fuera de la interfaz. Reproducir depende de conservar los supuestos junto a los números.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\mathrm{release\ evidence}=\{\mathrm{input\ identity},\ \mathrm{method},\ \mathrm{parameters},\ \mathrm{result},\ \mathrm{checks}\}`,
        caption: [
          "A reproducible result links the exact input identity, method and parameters to outputs and verification checks; matching a picture is insufficient.",
          "Un resultado reproducible vincula identidad exacta de entrada, método y parámetros con salidas y controles; coincidir con una imagen no basta.",
        ],
      },
    ],
    assumption: [
      "Offline evidence and current browser calculations are different execution lanes. Training and scientific rebaking are explicit local operations; publishing the website does not regenerate scientific results.",
      "La evidencia local y los cálculos actuales del navegador son vías de ejecución diferentes. Entrenar y recalcular evidencia científica son operaciones locales explícitas; publicar el sitio no regenera resultados científicos.",
    ],
    refs: ["mdnworkers", "pytorchsolve", "githubpages"],
    diagram: "pipeline",
  },
  {
    id: "verification-validation",
    title: [
      "What is verified, what is represented, and what remains empirical",
      "Qué se verifica, qué se representa y qué requiere evidencia empírica",
    ],
    paragraphs: [
      [
        "Verification asks whether the implemented equations are solved correctly. Analytic series and parallel circuits provide known answers. Reversing a passive edge tests the direction convention. Adding the same pressure offset to all boundaries tests gauge invariance. Independent nonlinear implementations expose shared-interface mistakes that a screenshot cannot find. CUDA-versus-CPU comparisons use identical resistance draws so that solver disagreement is separated from random-sampling disagreement. The benchmark exposes numerical residuals and differences from committed outputs rather than replacing them with a generic success badge.",
        "La verificación pregunta si las ecuaciones implementadas se resuelven correctamente. Circuitos analíticos en serie y paralelo dan respuestas conocidas. Invertir una rama pasiva prueba la convención de dirección. Sumar la misma presión a todos los bordes prueba invariancia de referencia. Implementaciones no lineales independientes revelan errores que una captura no detecta. Comparar CUDA y CPU utiliza las mismas realizaciones de resistencia para separar desacuerdo numérico de variación aleatoria. El benchmark expone residuos y diferencias desde salidas registradas en lugar de sustituirlos por una insignia genérica de éxito.",
      ],
      [
        "Validation asks whether those equations and inputs adequately represent a particular physical mine for a particular decision. That requires observations, measurement uncertainty, an appropriate calibration protocol and tests beyond the calibration conditions. The authored scenarios do not supply that evidence. Their resistance, equipment and geometry are transparent design assumptions useful for learning, algorithm comparison and repeatable what-if analysis. A learned model trained on their numerical solutions learns a simulator response; it does not become a field-trained model simply because the training run used a GPU.",
        "La validación pregunta si ecuaciones y entradas representan adecuadamente una mina física para una decisión específica. Requiere observaciones, incertidumbre de medición, calibración apropiada y pruebas fuera de las condiciones calibradas. Los escenarios creados no aportan esa evidencia. Resistencias, equipos y geometría son supuestos transparentes útiles para aprendizaje, comparación de algoritmos y análisis reproducible. Un modelo aprendido sobre soluciones numéricas aprende la respuesta de un simulador; no se convierte en modelo entrenado con terreno porque el entrenamiento utilizó GPU.",
      ],
      [
        "Visual fidelity must therefore be judged against the calculation it communicates. Flow direction, local quantities, branch identities, concentration fronts and intervention differences are meaningful when tied to actual model state. Decorative tube thickness, illustrative geology or apparent smoothness cannot replace those connections. Likewise, a confidence interval generated from assumed independent resistance variation is conditional on that assumption. It can help locate sensitivity and compare robustness, but it does not establish accident frequency, safe occupancy or a guarantee that a target will be met in service.",
        "La fidelidad visual se juzga frente al cálculo que comunica. Dirección, magnitudes locales, identidades, frentes de concentración y diferencias de intervención son significativas cuando corresponden al estado real del modelo. Espesor decorativo de tubos, geología ilustrativa o suavidad aparente no sustituyen esas conexiones. Del mismo modo, un intervalo calculado suponiendo variación independiente de resistencias es condicional a ese supuesto. Ayuda a localizar sensibilidad y comparar robustez, pero no establece frecuencia de accidentes, ocupación segura ni garantía de cumplimiento en servicio.",
      ],
    ],
    equations: [],
    assumption: [
      "The authored library supports reproducible engineering analysis and numerical verification. It provides no measured-mine calibration, occupational safety approval or direct equipment-control authority.",
      "La biblioteca creada permite análisis de ingeniería reproducible y verificación numérica. No aporta calibración de mina medida, aprobación de seguridad ocupacional ni autoridad de control directo de equipos.",
    ],
    refs: ["mcpherson1993", "nioshmfire", "sklearnleakage"],
  },
];
