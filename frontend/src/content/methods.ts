import type { ScientificSection } from "./primitives";

export const classicalMethods: ScientificSection[] = [
  {
    id: "pressure-flow",
    title: [
      "Pressure and flow: a coupled nonlinear network",
      "Presión y caudal: una red no lineal acoplada",
    ],
    paragraphs: [
      [
        "The network formulation separates topology from constitutive behavior. The incidence matrix says which junctions an airway connects and defines the positive flow convention. The resistance law says how the pressure difference along that airway depends on its signed flow. Neither equation alone determines the network: conservation permits many internally balanced flow fields, while independently applying branch losses would ignore the shared junction pressures. Aerovia therefore solves the coupled system. A pressure boundary supplies a known potential, and every active connected component must contain one. The boundary condition is part of the physical input, not a numerical convenience added to make an invalid graph solvable.",
        "La formulación separa topología de comportamiento constitutivo. La incidencia indica qué uniones conecta una galería y define el signo positivo. La ley de resistencia indica cómo la diferencia de presión depende del caudal con signo. Ninguna ecuación determina por sí sola la red: conservación permite muchos campos equilibrados y aplicar pérdidas por rama independientemente ignoraría las presiones compartidas. Aerovia resuelve el sistema acoplado. Una presión de borde aporta un potencial conocido y cada componente activa debe contener una. La condición de borde es entrada física, no una conveniencia numérica agregada para hacer resoluble un grafo inválido.",
      ],
      [
        "For a passive airway, pressure difference and flow have the same sign. The expression Q|Q| preserves that property when a connection reverses. A fan adds a nominal shutoff source multiplied by the square of common speed and subtracts a quadratic curve term. Combining the fan coefficient with the airway resistance gives a strictly positive effective coefficient for the supported inputs. The browser can then express each airway flow as a function of the two endpoint pressures. Internal pressures are the remaining unknowns. Area does not enter this hydraulic equation, so editing area changes derived velocity and transport volume but does not silently change solved flow.",
        "Para una galería pasiva, diferencia de presión y caudal tienen el mismo signo. Q|Q| conserva esa propiedad cuando se invierte una conexión. Un ventilador agrega una fuente nominal multiplicada por el cuadrado de velocidad común y resta un término cuadrático de curva. Combinar coeficiente del ventilador y resistencia produce un coeficiente efectivo estrictamente positivo para las entradas soportadas. El navegador expresa entonces cada caudal como función de sus presiones extremas. Las presiones internas son las incógnitas restantes. El área no entra en esta ecuación hidráulica: editarla cambia velocidad y volumen de transporte, sin cambiar silenciosamente el caudal.",
      ],
      [
        "Directly differentiating the inverse square law is troublesome near zero head because its slope becomes singular. The browser uses a normalized smooth continuation: head is divided by a pressure scale, resistance by a representative coefficient, and the inverse law is smoothed with progressively smaller epsilon. The actual sequence is 10⁻², 10⁻⁴, 10⁻⁶, 10⁻⁸, 10⁻¹⁰, 10⁻¹² and finally zero. A Newton step solves the nodal Jacobian with pivoted linear elimination. Backtracking halves the step until the residual or associated energy decreases. This is an implementation choice for robust numerical traversal, not a modification of the accepted physical law.",
        "Derivar directamente la ley inversa es problemático cerca de presión neta nula porque la pendiente se vuelve singular. El navegador usa continuación suave normalizada: divide presión por una escala, resistencia por un coeficiente representativo y suaviza la ley inversa con epsilon decreciente. La secuencia es 10⁻², 10⁻⁴, 10⁻⁶, 10⁻⁸, 10⁻¹⁰, 10⁻¹² y finalmente cero. Cada paso Newton resuelve el jacobiano nodal con eliminación y pivoteo. El retroceso divide el paso por dos hasta reducir residuo o energía asociada. Es una elección numérica para recorrer robustamente la solución, no una modificación de la ley física aceptada.",
      ],
      [
        "Iteration budgets are explicit: at most fifty updates per continuation stage, at most two hundred and forty overall, and at most thirty-two backtracking trials for an update. The descent coefficient is 10⁻⁴. These budgets prevent an ill-conditioned design from blocking indefinitely. After iteration, the solver discards smoothing and recomputes the original signed branch equations in SI units. It accepts only a maximum internal flow imbalance at or below 10⁻⁶ m³/s and maximum pressure mismatch at or below 10⁻⁵ Pa. A finite vector or a small update is insufficient. Unsupported reversed fans and negative delivered fan head also fail acceptance.",
        "Los presupuestos son explícitos: máximo cincuenta actualizaciones por etapa, doscientas cuarenta en total y treinta y dos retrocesos por actualización. El coeficiente de descenso es 10⁻⁴. Estos límites evitan bloquear indefinidamente por un diseño mal condicionado. Después de iterar se elimina el suavizado y se recalculan las ecuaciones originales en SI. Solo se acepta desequilibrio interno máximo de hasta 10⁻⁶ m³/s y desajuste de presión máximo de hasta 10⁻⁵ Pa. Un vector finito o una actualización pequeña no bastan. Ventiladores invertidos no soportados y presión entregada negativa también impiden aceptación.",
      ],
      [
        "The independent offline reference uses a different set of unknowns: all open-airway flows and internal pressures are solved together with SciPy trust-region reflective least squares and an analytical Jacobian. Residual components are normalized by characteristic flow and pressure scales, while final acceptance again uses the original absolute SI residuals. The reference uses tolerances of 10⁻¹³ and a maximum of fifteen hundred function evaluations. Independence here means a distinct nonlinear implementation, not independent physics: both solvers intentionally represent the same constant-density equations. Their agreement detects implementation discrepancies but cannot establish that assumed resistance matches an operating mine.",
        "La referencia local independiente usa otras incógnitas: resuelve conjuntamente caudales abiertos y presiones internas mediante mínimos cuadrados de región de confianza de SciPy y jacobiano analítico. Normaliza componentes por escalas de presión y caudal, pero acepta usando nuevamente residuos absolutos SI. Usa tolerancias de 10⁻¹³ y máximo mil quinientas evaluaciones. Independencia significa implementación no lineal distinta, no física independiente: ambos representan deliberadamente las mismas ecuaciones de densidad constante. Su concordancia detecta discrepancias de implementación; no establece que la resistencia supuesta corresponda a una mina operativa.",
      ],
      [
        "Read the resulting field through three separate lenses. First inspect numerical acceptance, because a rejected solve cannot support downstream tools. Then inspect signed local flow and velocity, because a positive total intake can conceal a reversed or starved working branch. Finally compare entered targets and fan demand, because delivery and energy are operational outcomes rather than solver stopping conditions. Pressure offsets have no effect when every boundary is shifted equally; pressure differences do. The scene, tables and charts should preserve these invariants, and an exported project should retain the conventions that make the signs interpretable.",
        "Lea el campo con tres criterios separados. Primero acepte numéricamente: una solución rechazada no sostiene herramientas posteriores. Después revise caudal y velocidad locales con signo: un total positivo puede ocultar una labor invertida o deficitaria. Finalmente compare objetivos y demanda: son resultados operativos, no condiciones de término numérico. Sumar la misma presión a todos los bordes no tiene efecto; las diferencias sí. Escena, tablas y gráficos deben conservar estas invariancias, y el proyecto exportado debe conservar las convenciones que permiten interpretar los signos.",
      ],
    ],
    equations: [
      {
        tex: String.raw`B_IQ=0,\qquad B^Tp+H_0s^2-(R+k)\odot Q\odot|Q|=0`,
        caption: [
          "B and B_I are full and internal incidence matrices; p is pressure (Pa), Q is signed flow (m³/s), H₀ is fan shutoff pressure (Pa), s is relative speed and R,k are quadratic coefficients. Products marked ⊙ are elementwise.",
          "B y B_I son incidencias completa e interna; p es presión (Pa), Q es caudal (m³/s), H₀ es presión de cierre (Pa), s es velocidad relativa y R,k son coeficientes cuadráticos. ⊙ indica producto elemento a elemento.",
        ],
      },
      {
        tex: String.raw`q_\epsilon(h)=\frac{h}{\sqrt{r}(h^2+\epsilon^2)^{1/4}},\qquad J\,\delta p=-B_Iq_\epsilon`,
        caption: [
          "h and r are dimensionless head and resistance; ε is continuation smoothing; qε is normalized flow; J is the nodal residual Jacobian and δp is the normalized pressure update. Final acceptance uses ε=0.",
          "h y r son presión neta y resistencia adimensionales; ε suaviza la continuación; qε es caudal normalizado; J es jacobiano de residuo y δp es actualización de presión normalizada. La aceptación final usa ε=0.",
        ],
      },
    ],
    symbols: [
      [
        "Pressure coordinates have a gauge freedom; fixed boundaries remove it.",
        "Las presiones tienen libertad de referencia; los bordes fijos la eliminan.",
      ],
      [
        "Closed branches retain an identity but carry zero flow in the hydraulic solve.",
        "Las ramas cerradas conservan identidad pero tienen caudal hidráulico cero.",
      ],
    ],
    assumption: [
      "Steady, constant-density turbulent network behavior; no natural ventilation pressure, compressibility, thermal coupling, or reverse-fan performance map. A solved network may still miss every entered target.",
      "Comportamiento turbulento estacionario y de densidad constante; sin presión natural, compresibilidad, acoplamiento térmico ni mapa de ventilador invertido. Una red resuelta puede incumplir todos los objetivos.",
    ],
    refs: ["mcpherson1993", "scipytrf"],
    diagram: "network",
  },
  {
    id: "fan-control",
    title: [
      "Fan operating points, constrained speed and sensitivity",
      "Puntos del ventilador, velocidad restringida y sensibilidad",
    ],
    paragraphs: [
      [
        "A fan curve is a relationship between delivered pressure and flow, not a fixed pressure imposed everywhere in the mine. Aerovia uses a monotone quadratic curve with a nominal shutoff pressure and a positive curve coefficient. The operating point results from intersecting that device behavior with the entire connected network. Increasing resistance can reduce total flow and increase the pressure delivered at the new operating point, while redistribution can improve one district and harm another. An aggregate fan curve therefore cannot replace a local target inspection. With several fans, a single equivalent-system curve has additional assumptions and must not conceal the separate devices.",
        "Una curva de ventilador relaciona presión entregada y caudal; no impone presión fija en toda la mina. Aerovia usa una curva cuadrática monótona con presión nominal de cierre y coeficiente positivo. El punto operativo resulta de combinar ese dispositivo con toda la red. Aumentar resistencia puede reducir caudal total y aumentar presión entregada, mientras redistribuir beneficia un distrito y perjudica otro. Una curva agregada no sustituye revisar objetivos locales. Con varios ventiladores, una curva equivalente única requiere supuestos adicionales y no debe ocultar dispositivos separados.",
      ],
      [
        "Under equal fixed boundary pressures and the supported quadratic laws, common-speed changes have an exact homogeneity. If a unit-speed solution exists, multiplying every fan’s speed by the same nonnegative factor multiplies flows by that factor and relative pressures by its square. With constant entered efficiency, electrical power scales cubically. This identity is both an explanatory tool and an independent regression check. It does not hold for arbitrary independent fan controls, added fixed pressure differences, changing resistance or a nonquadratic operating map. The speed envelope still solves every requested point and reports unsupported states rather than drawing a plausible curve through failures.",
        "Con presiones de borde iguales y leyes cuadráticas soportadas existe homogeneidad exacta de velocidad común. Si existe solución a velocidad unitaria, multiplicar la velocidad de todos los ventiladores por un factor no negativo multiplica caudales por ese factor y presiones relativas por su cuadrado. Con eficiencia constante, la potencia escala al cubo. La identidad explica el modelo y ofrece una prueba independiente. No vale para controles independientes arbitrarios, diferencias fijas de borde, resistencia cambiante ni mapas no cuadráticos. La envolvente resuelve cada punto solicitado e informa estados no soportados, sin dibujar curvas plausibles a través de fallos.",
      ],
      [
        "The minimum-speed operation asks a tightly bounded optimization question: what is the lowest common speed in the supported interval that meets every positive forward-flow target? It first evaluates zero and the maximum supported speed of one and a half times nominal. If the upper endpoint cannot meet the targets with a supported converged solution, the entered request is infeasible within that interval. If no positive targets exist, the zero-speed condition can be the feasible answer. Otherwise twenty-six bisection steps retain a solved feasible upper bound. The returned answer includes its actual network solution and evaluation count, not merely a proposed slider position.",
        "La operación de velocidad mínima hace una pregunta acotada: cuál es la menor velocidad común soportada que satisface todos los objetivos positivos. Primero evalúa cero y el máximo de una vez y media la nominal. Si el extremo superior no satisface objetivos con solución soportada y convergente, la solicitud es inviable en ese intervalo. Sin objetivos positivos, velocidad cero puede ser factible. En otro caso, veintiséis bisecciones conservan un extremo superior factible resuelto. La respuesta incluye solución real y cantidad de evaluaciones, no solo una posición sugerida del control.",
      ],
      [
        "Unequal fixed boundary pressures are deliberately excluded from that monotone feasibility search. Their independent forcing can alter flow direction or make target response non-monotone as fan speed varies. A generic network solve can still be valid, and a sampled envelope can still be informative, but the bisection guarantee no longer follows from the common-speed scaling argument. Distinguishing unsupported optimization from infeasible design prevents a software limitation being presented as an engineering impossibility. Likewise, minimizing one common speed is not a global optimum over regulator settings, equipment choices, separate fan speeds or new excavations.",
        "Presiones de borde desiguales se excluyen de esa búsqueda monótona. Su forzamiento independiente puede alterar dirección o volver no monótona la respuesta de objetivos frente a velocidad. Resolver la red todavía puede ser válido y una envolvente muestreada puede informar, pero la garantía de bisección deja de seguirse de la homogeneidad. Diferenciar optimización no soportada y diseño inviable evita presentar una limitación del software como imposibilidad física. Minimizar velocidad común tampoco es optimizar globalmente reguladores, equipos, velocidades independientes ni excavaciones.",
      ],
      [
        "Sensitivity asks another question: which single resistance perturbation has the largest effect on the current limiting target ratio? Each open airway receives a separate five-percent resistance increase while all other active inputs are held fixed. The solver recomputes the full network, so the reported response includes redistribution rather than an isolated-pipe approximation. The dimensionless elasticity is a finite difference normalized by the magnitude of the baseline target ratio and by the imposed five-percent change. Power and intake differences accompany it in physical units. Near a zero baseline ratio, the normalized elasticity is suppressed rather than divided by an unstable denominator.",
        "La sensibilidad pregunta qué perturbación individual de resistencia tiene mayor efecto sobre la razón limitante actual. Cada galería abierta recibe por separado un aumento de cinco por ciento, conservando las demás entradas. Se recalcula toda la red, de modo que la respuesta incluye redistribución y no una aproximación de conducto aislado. La elasticidad adimensional es una diferencia finita normalizada por magnitud de la razón inicial y por el cinco por ciento impuesto. Se acompaña de diferencias de potencia y admisión en unidades físicas. Cerca de razón inicial cero se suprime la elasticidad normalizada para evitar dividir por un denominador inestable.",
      ],
      [
        "Use the sensitivity ranking to choose a follow-up intervention, not to claim a universally best design. The limiting airway can change after a perturbation, making the minimum-target objective nondifferentiable. A five-percent one-at-a-time response can therefore differ from a large combined modification. Save a baseline, select the responsible airway in the spatial view, apply the actual proposed resistance or topology change, and compare a fresh solution. When converting fan demand to energy or cost, preserve hours, efficiency and tariff assumptions explicitly. A calculated difference is a conditional scenario saving, not a measured production saving.",
        "Use la clasificación para elegir una intervención siguiente, no para afirmar un diseño universalmente mejor. La galería limitante puede cambiar tras perturbar, haciendo no diferenciable el mínimo objetivo. Una respuesta individual de cinco por ciento puede diferir de una modificación grande combinada. Guarde referencia, seleccione la galería responsable, aplique el cambio real de resistencia o topología y compare una nueva solución. Al convertir demanda a energía o costo conserve horas, eficiencia y tarifa explícitas. La diferencia calculada es ahorro condicional de escenario, no ahorro medido de producción.",
      ],
    ],
    equations: [
      {
        tex: String.raw`H(Q,s)=H_0s^2-kQ|Q|,\quad Q(s)=sQ(1),\quad p(s)-p_b=s^2[p(1)-p_b]`,
        caption: [
          "H is delivered fan pressure; H₀ and k define its curve; s is common relative speed; Q is flow; p_b is the shared boundary pressure. The scaling relations require equal boundary pressures and fixed quadratic coefficients.",
          "H es presión entregada; H₀ y k definen curva; s es velocidad común; Q es caudal; p_b es presión de borde compartida. La homogeneidad requiere bordes iguales y coeficientes cuadráticos fijos.",
        ],
      },
      {
        tex: String.raw`s^*=\min_{0\le s\le1.5}\{s:\min_{e:t_e>0}Q_e(s)/t_e\ge1\}`,
        caption: [
          "s* is the least supported common speed; t_e is the positive forward-flow target (m³/s). A feasible answer also requires numerical acceptance and a supported fan operating state.",
          "s* es la menor velocidad común soportada; t_e es objetivo positivo (m³/s). Factibilidad requiere además aceptación numérica y operación soportada del ventilador.",
        ],
      },
      {
        tex: String.raw`\mathcal E_e=\frac{T(R_e\cdot1.05)-T(R)}{0.05\,|T(R)|},\qquad T(R)=\min_{j:t_j>0}\frac{Q_j(R)}{t_j}`,
        caption: [
          "𝓔_e is the one-at-a-time +5% resistance elasticity of the minimum target ratio T. It is a local finite difference, not a global derivative or optimum.",
          "𝓔_e es elasticidad de resistencia individual +5% de la razón mínima T. Es diferencia finita local, no derivada global ni óptimo.",
        ],
      },
    ],
    assumption: [
      "Optimization changes one common fan-speed scalar and requires equal pressure boundaries. Sensitivity fixes every unperturbed input. Neither operation supplies a regulatory target or a globally optimal mine design.",
      "La optimización cambia una velocidad común y requiere presiones de borde iguales. La sensibilidad fija entradas no perturbadas. Ninguna suministra un objetivo normativo ni diseño global óptimo.",
    ],
    refs: ["mcpherson1993", "scipybisect"],
    diagram: "fans",
  },
  {
    id: "resistance-uncertainty",
    title: [
      "Conditional resistance uncertainty and GPU ensembles",
      "Incertidumbre condicional de resistencia y conjuntos GPU",
    ],
    paragraphs: [
      [
        "The uncertainty calculation starts with a statement about the inputs, not a confidence label attached to the output. Each entered airway resistance is multiplied by an independent positive lognormal random variable. The supplied coefficient of variation controls the arithmetic spread, and the logarithmic mean is adjusted so that the multiplier has arithmetic mean one. This distinction matters: entering a zero logarithmic mean would increase average resistance as spread rises, conflating a change in mean with uncertainty around the same mean. Fan coefficients, areas, targets and geometry remain fixed unless a different experiment explicitly changes them.",
        "La incertidumbre comienza declarando entradas, no pegando una etiqueta de confianza a la salida. Cada resistencia ingresada se multiplica por una variable lognormal positiva independiente. El coeficiente de variación controla dispersión aritmética y la media logarítmica se ajusta para que el multiplicador tenga media uno. Importa: una media logarítmica cero aumentaría resistencia media al crecer dispersión, confundiendo cambio de media e incertidumbre alrededor de la misma media. Coeficientes de ventilador, áreas, objetivos y geometría permanecen fijos salvo que otro experimento los cambie explícitamente.",
      ],
      [
        "A seeded NumPy generator produces the complete float64 resistance draw array before either numerical backend runs. CPU and CUDA therefore receive identical physical inputs. The CUDA backend batches mixed flow-pressure nonlinear systems and solves their linear updates using PyTorch numerical linear algebra. Samples are processed in bounded chunks rather than allocating all dense Jacobians simultaneously. Actual device, dtype, software versions, batch size and timings accompany the result. A successful CUDA installation is not execution evidence; the recorded backend and measured run are. The CPU path uses NumPy and remains available without installing a machine-learning runtime.",
        "Un generador NumPy con semilla produce todo el arreglo float64 de resistencias antes de ejecutar motores. CPU y CUDA reciben entradas físicas idénticas. CUDA agrupa sistemas no lineales mixtos de caudal y presión y resuelve sus actualizaciones lineales con álgebra numérica de PyTorch. Procesa bloques acotados, sin asignar todos los jacobianos densos simultáneamente. Dispositivo real, precisión, versiones, tamaño de lote y tiempos acompañan la salida. Instalar CUDA no prueba ejecución; la prueban motor registrado y corrida medida. La ruta CPU usa NumPy y sigue disponible sin entorno de aprendizaje automático.",
      ],
      [
        "Every realization passes the same physical acceptance criteria as a deterministic solve. Its maximum junction imbalance, branch pressure mismatch and fan regime are checked separately from the nonlinear stopping condition. Rejected sample identities and failure counts are retained. A canonical published ensemble is not silently accepted after dropping inconvenient failures, because selective rejection can bias the distribution precisely where the network becomes difficult. Independent reference checks select saved draw indices and solve them with SciPy using the exact resistance overrides. Their maximum branch-flow difference measures cross-implementation agreement, not the statistical accuracy of the ensemble percentiles.",
        "Cada realización supera los mismos criterios físicos que un cálculo determinista. Desequilibrio nodal, desajuste de presión y régimen del ventilador se controlan separadamente de la condición de término. Se retienen identidades rechazadas y fallos. No se acepta un conjunto canónico eliminando silenciosamente fallos incómodos: el rechazo selectivo sesga la distribución justo donde la red es difícil. Referencias independientes seleccionan índices guardados y resuelven SciPy con las mismas resistencias. La diferencia máxima de caudal mide concordancia entre implementaciones, no exactitud estadística de percentiles.",
      ],
      [
        "For each airway the artifact records lower, median and upper flow quantiles and the empirical fraction meeting its positive forward target. Quantiles use linear interpolation of ordered samples. At a fixed sample count, the target fraction changes in increments of one divided by that count; reporting additional decimal places does not create information. A branch with no positive target has a conventional attainment value of one, which carries no compliance meaning. Near a limiting target, a useful view shows both the interval in physical units and the target marker. That makes the assumed variation interpretable without reducing it to a red or green badge.",
        "Para cada galería se registran cuantiles inferior, mediano y superior y fracción empírica que satisface el objetivo positivo. Los cuantiles interpolan linealmente muestras ordenadas. Con cantidad fija, la fracción cambia en incrementos de uno dividido por esa cantidad; más decimales no crean información. Sin objetivo positivo se usa convencionalmente cumplimiento uno, sin significado normativo. Cerca de un objetivo limitante conviene mostrar intervalo en unidades físicas y marcador del objetivo. Así se interpreta la variación supuesta sin reducirla a una insignia roja o verde.",
      ],
      [
        "Independence is an especially consequential assumption for a mine network. Several airways may share a survey bias, friction regime, ventilation door behavior or maintenance condition. Independent draws cannot represent such common causes. Similarly, a lognormal family is a positive uncertainty model, not an inference from the authored cases. The conditional ensemble can identify which targets are sensitive under that model and compare interventions consistently, but it cannot establish real exceedance probabilities without defensible input distributions. Rare-event interpretation also needs a sampling design and sample count appropriate to the event probability, beyond a compact interactive showcase ensemble.",
        "La independencia es un supuesto especialmente importante. Varias galerías pueden compartir sesgo de levantamiento, fricción, comportamiento de puertas o mantenimiento. Realizaciones independientes no representan esas causas comunes. La familia lognormal es un modelo positivo de incertidumbre, no inferencia desde casos creados. El conjunto identifica objetivos sensibles bajo ese modelo y compara intervenciones coherentemente, pero no establece probabilidades reales sin distribuciones defendibles. Interpretar eventos raros exige diseño y cantidad de muestras adecuados a su probabilidad, más allá de un conjunto compacto para inspección interactiva.",
      ],
      [
        "An ensemble belongs to its exact input network and operating options. If the browser changes topology, fan settings, resistance, targets or area, the earlier artifact is no longer uncertainty for the active design. Matching only the case name is insufficient. Source and options identities gate whether replay evidence is applicable. For an edited or imported project, the correct workflow is to export those inputs and execute a new local batch, then validate the resulting artifact. The deterministic browser solve and the offline ensemble remain separate execution lanes, even when both are displayed beside the same geometry.",
        "Un conjunto pertenece a su red exacta y opciones operativas. Si el navegador cambia topología, ventiladores, resistencia, objetivos o área, el artefacto previo deja de ser incertidumbre del diseño activo. Coincidir solo en nombre no basta. Identidades de fuente y opciones controlan aplicabilidad. Para un proyecto editado o importado corresponde exportar entradas, ejecutar nuevo lote local y validar resultado. El cálculo determinista del navegador y el conjunto local son vías distintas aunque aparezcan junto a la misma geometría.",
      ],
    ],
    equations: [
      {
        tex: String.raw`\sigma=\sqrt{\log(1+c^2)},\qquad R_e^{(j)}=R_e\exp(\sigma Z_e^{(j)}-\sigma^2/2),\quad Z_e^{(j)}\sim\mathcal N(0,1)`,
        caption: [
          "c is entered coefficient of variation; σ is logarithmic standard deviation; Z are independent standard-normal draws; R_e^(j) is the sampled resistance. The multiplier has arithmetic mean 1 and coefficient of variation c.",
          "c es coeficiente de variación; σ es desviación logarítmica; Z son normales estándar independientes; R_e^(j) es resistencia muestreada. El multiplicador tiene media aritmética 1 y coeficiente de variación c.",
        ],
      },
      {
        tex: String.raw`\widehat a_e=\frac1N\sum_{j=1}^N\mathbf1\!\left[Q_e^{(j)}\ge t_e\right],\qquad d_{\mathrm{parity}}=\max_{j\in S,e}|Q_{e,\mathrm{batch}}^{(j)}-Q_{e,\mathrm{reference}}^{(j)}|`,
        caption: [
          "â_e is empirical conditional target attainment, N is accepted sample count and t_e is the entered target. S is the independently re-solved subset; d_parity is maximum flow disagreement (m³/s).",
          "â_e es fracción condicional de cumplimiento, N es número aceptado y t_e es objetivo ingresado. S es subconjunto resuelto independientemente; d_parity es desacuerdo máximo de caudal (m³/s).",
        ],
      },
    ],
    assumption: [
      "Independent lognormal resistance variation is a declared scenario model. It is not fitted mine uncertainty, statistical safety certification or evidence that edited browser inputs retain the same interval.",
      "Variación lognormal independiente es un modelo declarado de escenario. No es incertidumbre de mina ajustada, certificación estadística de seguridad ni evidencia de que entradas editadas conserven el intervalo.",
    ],
    refs: ["numpylognormal", "pytorchsolve", "scipytrf"],
    diagram: "uncertainty",
  },
  {
    id: "passive-transport",
    title: [
      "Passive tracer transport, schedules and airflow routes",
      "Transporte de trazador, programas y rutas del aire",
    ],
    paragraphs: [
      [
        "A pressure solution says how much air moves; it does not describe when a released material reaches another part of the network. Aerovia adds a separate conservative transport calculation with one-dimensional finite volumes along each airway. The state is tracer mass in milligrams. Dividing by cell volume gives concentration in milligrams per cubic meter. For a branch of represented length L and area A, N equal cells each have volume AL/N. Length is the distance between node coordinates unless a measured-length override is supplied. Coincident endpoints require a positive explicit length rather than an invented minimum.",
        "La solución de presión indica cuánto aire circula, no cuándo material liberado alcanza otra parte de la red. Aerovia agrega transporte conservativo con volúmenes finitos unidimensionales por galería. El estado es masa de trazador en miligramos; dividir por volumen da concentración en miligramos por metro cúbico. Una rama de longitud L y área A contiene N celdas de volumen AL/N. La longitud es distancia entre nodos salvo longitud medida explícita. Extremos coincidentes requieren longitud positiva suministrada, sin inventar un mínimo.",
      ],
      [
        "Each advective face transports the upstream concentration multiplied by the magnitude of solved flow. Negative branch flow reverses the upstream cell order; it does not produce negative concentration. At an internal junction, incoming tracer flux is mixed and divided among outgoing branches in proportion to their outward airflow. The junction itself has no storage. Pressure boundaries are clean external reservoirs: tracer entering a boundary escapes, and air leaving that reservoir is tracer-free. This convention prevents artificial recirculation through an atmosphere node shared by several branches. The last airway cell, rather than the boundary node, is the meaningful exit-concentration observation.",
        "Cada cara transporta concentración aguas arriba multiplicada por magnitud de caudal. Caudal negativo invierte el orden aguas arriba, sin producir concentración negativa. Una unión interna mezcla flujo másico entrante y lo distribuye proporcionalmente al caudal saliente; no almacena masa. Los bordes de presión son reservorios externos limpios: trazador que entra escapa y aire que sale no contiene trazador. Así se evita recircular artificialmente por un nodo atmosférico compartido. La última celda de galería, no el nodo de borde, permite observar concentración de salida.",
      ],
      [
        "Sources can be an instantaneous mass pulse or a finite-duration constant mass-rate release. Their position is a fraction measured from the original source endpoint, independent of current flow direction. A source inside a closed or stagnant branch remains stored. Closing that branch does not delete its tracer, and reopening can transport the retained mass. An optional first-order loss coefficient removes mass at a rate proportional to current storage; the removed amount remains in the ledger. It is a numerical tracer sink chosen by the user, not an inferred toxicology, deposition or chemical reaction parameter.",
        "Las fuentes son pulsos instantáneos de masa o liberaciones de tasa constante y duración finita. Su posición es fracción desde el extremo original, independiente del sentido actual. Una fuente en rama cerrada o estancada permanece almacenada. Cerrar no elimina trazador y reabrir transporta masa retenida. Un coeficiente opcional de pérdida de primer orden remueve masa proporcional al almacenamiento y registra lo removido. Es sumidero numérico elegido, no parámetro inferido de toxicología, deposición ni reacción química.",
      ],
      [
        "The integrator uses two-stage strong-stability-preserving Runge–Kutta, equivalent here to the explicit trapezoidal update. Both stage evaluations contribute to mass-ledger quadrature. The time step is bounded so that dt times the largest local outflow-over-volume plus loss coefficient does not exceed 0.45. Integration segments align exactly with requested output times, source starts and stops, pulse events and changes in operating options. A smaller maximum step provides a time-refinement experiment. Increasing cells reduces first-order spatial numerical dispersion, but also raises the work needed to satisfy the time-step constraint. Second-order time integration does not remove first-order spatial mixing.",
        "El integrador usa Runge–Kutta de dos etapas que preserva estabilidad fuerte, equivalente aquí al trapecio explícito. Ambas etapas aportan al registro de masa. Se acota paso para que dt por máxima salida sobre volumen más coeficiente de pérdida no supere 0,45. Los segmentos coinciden exactamente con tiempos de salida, inicio y fin de fuentes, pulsos y cambios operativos. Reducir paso máximo permite refinamiento temporal. Aumentar celdas reduce dispersión espacial de primer orden, pero aumenta trabajo para cumplir estabilidad. Integrar tiempo con segundo orden no elimina mezcla espacial de primer orden.",
      ],
      [
        "A schedule supplies complete operating states at ordered times. At each event, the existing hydraulic solver recomputes a quasi-steady airflow field; transport mass persists and follows any new signed direction. This enables controlled comparisons of reduced speed, closures and reopening without pretending to simulate pressure waves or fan inertia. Area cannot change inside one schedule because cell volumes remain fixed: moving volumes would need an additional displacement convention. The returned frames retain cell concentrations, branch means, active flow-state identity and injected, stored, escaped and removed mass. Their balance error is an essential diagnostic, not optional background metadata.",
        "Un programa aporta estados operativos completos en tiempos ordenados. En cada evento se recalcula caudal cuasiestacionario; la masa persiste y sigue cualquier dirección nueva. Permite comparar reducción de velocidad, cierres y reapertura sin fingir ondas de presión ni inercia del ventilador. El área no cambia dentro de un programa porque los volúmenes son fijos; mover volumen requiere otra convención de desplazamiento. Los cuadros retienen concentraciones de celdas, medias de rama, identidad de flujo y masa inyectada, almacenada, escapada y removida. Su error de balance es diagnóstico esencial.",
      ],
      [
        "Airflow routing is a complementary graph calculation. Each nonstagnant edge is oriented with its actual solved flow and receives a nonnegative nominal transit weight AL/|Q|. A shortest weighted path minimizes the sum of those weights; it is different from the shortest geometric path. Pressure boundaries terminate a route, and unreachable nodes remain unreachable. Strongly connected components identify directed recirculation structure. These paths are neither safe human routes nor earliest tracer arrival: finite-volume mixing spreads concentration in time, and real tunnel transport has additional physics. Use routing to explain connectivity and nominal residence, then use the tracer history for the modeled concentration question.",
        "Las rutas de aire complementan con cálculo de grafo. Cada rama no estancada sigue su caudal real y recibe peso no negativo AL/|Q|. El camino mínimo suma esos pesos, distinto de distancia geométrica mínima. Los bordes terminan rutas y nodos inaccesibles permanecen así. Componentes fuertemente conexas identifican recirculación dirigida. No son rutas seguras humanas ni primera llegada de trazador: la mezcla por volúmenes finitos dispersa concentración y túneles reales agregan física. Use rutas para explicar conectividad y residencia nominal; use historia de trazador para concentración modelada.",
      ],
    ],
    equations: [
      {
        tex: String.raw`V_i=\frac{A_eL_e}{N_e},\quad C_i=\frac{m_i}{V_i},\quad\frac{dm_i}{dt}=\sum F_{\mathrm{in},i}-\sum F_{\mathrm{out},i}+S_i-\lambda m_i,\quad F=|Q|C_{\mathrm{up}}`,
        caption: [
          "V is cell volume (m³), A is area (m²), L is length (m), N is cell count, m is tracer mass (mg), C is concentration (mg/m³), F and S are mass rates (mg/s), and λ is optional first-order loss (s⁻¹).",
          "V es volumen (m³), A área (m²), L longitud (m), N cantidad de celdas, m masa (mg), C concentración (mg/m³), F y S tasas másicas (mg/s) y λ pérdida de primer orden opcional (s⁻¹).",
        ],
      },
      {
        tex: String.raw`\Delta t\max_i\left(\frac{|Q_i|}{V_i}+\lambda\right)\le0.45,\quad M_{\mathrm{injected}}=M_{\mathrm{stored}}+M_{\mathrm{escaped}}+M_{\mathrm{removed}}+\varepsilon_M`,
        caption: [
          "Δt is integration step (s); the stability bound supports nonnegative updates. The mass ledger compares all quantities in mg, with ε_M the numerical balance error.",
          "Δt es paso (s); la restricción permite actualizaciones no negativas. El registro compara todas las masas en mg; ε_M es error numérico de balance.",
        ],
      },
      {
        tex: String.raw`\tau_e=\frac{A_eL_e}{|Q_e|},\qquad \pi^*=\arg\min_{\pi:u\leadsto v}\sum_{e\in\pi}\tau_e`,
        caption: [
          "τ_e is nominal branch residence weight (s); π is a directed airflow path from u to v. Stagnant edges do not have finite transit weights; π* is not an evacuation route or earliest concentration arrival.",
          "τ_e es peso de residencia nominal (s); π es camino dirigido de aire de u a v. Ramas estancadas no tienen peso finito; π* no es ruta de evacuación ni primera llegada de concentración.",
        ],
      },
    ],
    assumption: [
      "Cross-section-averaged passive transport on quasi-steady airflow, with numerical dispersion and clean boundaries. No fire, buoyancy, toxicology, compressible transient or human-egress model is represented.",
      "Transporte pasivo medio de sección sobre caudal cuasiestacionario, con dispersión numérica y bordes limpios. No representa incendio, flotabilidad, toxicología, transiente compresible ni egreso humano.",
    ],
    refs: ["nistcontam", "clawpackadvection", "jong2016", "networkxpaths"],
    diagram: "transport",
  },
];
