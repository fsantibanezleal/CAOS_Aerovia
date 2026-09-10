# Passive tracer transport / Transporte de trazador pasivo

## English: what this tool calculates

The transport tool predicts the movement of a user-defined passive tracer through an airway network. A pulse or sustained source changes a calculated concentration field, which can be inspected along each airway and over time. Operating schedules can alter fan speed, resistance or closure, then carry the existing tracer field through the changed signed airflow. The calculation supplies the data for scene colouring, concentration histories, time scrubbing and comparisons.

The implementation is `frontend/src/engine/transport.ts`; analytical and adversarial checks are in `transport.test.ts`. It uses the existing validated steady airflow solver. No remote service, Python runtime or extra JavaScript numerical dependency is required for this bounded calculation.

The independent design uses a mass-balance model with airflow, sources and sinks. NIST's multizone theory supplies a relevant methodological reference for separating airflow equilibrium from concentration evolution; Aerovia does not implement the full CONTAM model or its integration algorithms. [NIST CONTAM theory, sections 8.1–8.2](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1887r1.pdf)

## Geometry, state and units

| Quantity | Symbol | Unit | Meaning |
|---|---|---|---|
| Signed airflow | Q | m³/s | Existing network solution; positive from declared `from` to `to` |
| Airway area | A | m² | Effective area after the current override |
| Airway length | L | m | Explicit override, otherwise endpoint distance in the network coordinates |
| Cells per airway | N | dimensionless | Equal subdivisions, default 6 |
| Cell volume | V=A L/N | m³ | Fixed throughout one scheduled run |
| Tracer mass | m | mg | Conserved state in each cell |
| Concentration | C=m/V | mg/m³ | Cell concentration; airway output is its volume average |
| Continuous source | S | mg/s | Constant over its specified active interval |
| First-order loss | λ | s⁻¹ | Optional user-defined sink, default zero |

Lengths are straight endpoint distances unless supplied in `edgeLengths`. A bent physical airway needs its physical length override; a visually bent line is not evidence of a measured length. Zero-length geometry is rejected. Lengths below 10⁻⁶ m are outside the numerical contract, and explicit lengths above 10⁷ m are rejected. Values are never silently replaced by a minimum. Coordinate units therefore affect transit times and concentrations directly.

Cells are always stored in declared `from` → `to` order. Reverse airflow traverses that array backwards; changing direction never reverses the stored material state. Source `position` is a fraction of that original coordinate, from 0 to 1. It is deposited in its containing cell. At an internal cell interface, within 10⁻¹² in cell-index coordinates, the source is shared equally between the two adjacent cells. This symmetric convention preserves the physical result when edge orientation and source coordinate are reversed.

These concentrations are mass per volume, not ppm. No gas identity, molar mass or standard-temperature conversion is assumed.

## Conservative flux and junction equations

An advective face carries `F=abs(Q)*C_upstream` mg/s. For cell i:

```text
dm_i/dt = F_in,i - F_out,i + S_i - λ m_i
C_i = m_i / V_i
```

At an internal zero-volume junction j, compute the arriving tracer rate `G_j = sum(abs(Q_e)*C_last,e)` over incoming branches. Let `Q_out,j` be the sum of outgoing airflow magnitudes. Each outgoing branch receives `G_j*abs(Q_e)/Q_out,j`. This exactly distributes the incoming tracer flux. The displayed mixed concentration is `G_j/Q_out,j`. A converged pressure solution has only the accepted small airflow residual; dividing by summed outgoing flow prevents that residual from creating or destroying tracer.

Every pressure boundary is a clean external reservoir. Tracer arriving there is added to escaped mass. Air leaving that reservoir into any branch contains zero tracer. Consequently, a shared external boundary does not act as a recirculating internal junction. Its displayed node concentration is zero. To inspect a model outlet concentration, inspect the terminal cell of its incoming airway.

Closed and stagnant branches retain their volume and mass. A source inside one can accumulate, decay, and move again after reopening. A closed branch's material is never erased. A junction with incoming flow but no outgoing path cannot support this zero-volume balance and is rejected.

This construction is a first-order spatial upwind discretization, also interpretable as well-mixed tanks in series. Its transport is conservative but numerically dispersive. The finite-volume conservation principle and upstream advective flux follow standard scalar-advection theory. [Clawpack authors' conservation and advection chapter](https://www.clawpack.org/riemann_book/html/Advection.html)

## Time integration and event ordering

The code independently implements the two-stage strong-stability-preserving Runge–Kutta update:

```text
m*     = mⁿ + Δt f(mⁿ)
mⁿ⁺¹   = 0.5 mⁿ + 0.5 [m* + Δt f(m*)]
Δt * max_cells(abs(Q)/V + λ) <= 0.45
```

The step restriction makes each forward Euler substep nonnegative for this compartment system. The two-stage average retains that property. Escaped and removed mass use the same two-stage quadrature as the cell update, so the ledger matches the actual transfers. Source rates are constant inside each event interval and integrate over their exact active duration.

The integration partitions time at every requested output, pulse, source start/end and operating change. It subdivides each interval to satisfy the stability restriction and optional `maxStepSeconds`. At an event, it finishes transport with the old flow state, selects the new flow state, injects any pulse, and captures the output. A pulse at t=10 s therefore already appears in the 10 s frame. It is not spread over the nearest output interval.

Time accuracy is second order between events; spatial accuracy remains first order. More output frames can force smaller time steps, so frame count can slightly affect the numerical answer. A small mass-balance error alone does not establish temporal or spatial accuracy. Use a smaller `maxStepSeconds` for time refinement and increase cells for spatial refinement.

## Quasi-steady operating schedules

`solveFlowTimeline` validates and sorts a list of complete operating states. Each change solves a new pressure-flow equilibrium. The transport solver uses that solution until the next event. It preserves the cell masses when flow magnitude or direction changes.

This is quasi-steady scheduled transport. The model contains neither fan acceleration nor compressible pressure dynamics, actuator lag, thermal buoyancy, turbulent eddies or a three-dimensional fluid mesh. A rapid fan step is a mathematical operating change, not a prediction of the real fan's transient response.

Every schedule entry supplies complete `SolveOptions`; omitted overrides do not inherit from the preceding entry. Changes must have distinct positive times within the simulation. Area must remain equal to the initial effective area on every branch. A different fixed area can be compared in a separate run. Changing volume during a run would require an additional displacement/storage model, so it is rejected.

## API and reproducible use

```ts
import { simulateTransport, solveFlowTimeline } from './engine/transport'

const request = {
  durationSeconds: 600,
  frameCount: 121,
  cellsPerEdge: 6,
  releases: [{
    kind: 'pulse' as const,
    edgeId: sourceAirwayId,
    position: 0.5,
    startSeconds: 0,
    massMg: 1000,
  }],
  schedule: [{ timeSeconds: 180, options: { ...options, speed: 0.75 } }],
  decayPerSecond: 0,
}
const result = simulateTransport(network, options, request)
if (!result.completed) throw new Error(result.message)
const selectedFrame = result.frames[36] // 180 s in this 5 s output grid
const independentlyInspectableFlows = solveFlowTimeline(network, options, request.schedule)
```

The alternative release is `{kind:'continuous', edgeId, position?, startSeconds, durationSeconds, rateMgPerSecond}`. Multiple releases add linearly within the fixed airflow scenario. A continuous source must finish within the simulation; it is not silently truncated.

The result schema is `aerovia.transport/v1`. It returns lengths, volumes, cells per airway, calculated flow states, steps, elapsed time and warnings. Each frame returns:

- `timeSeconds`, `flowStateIndex`;
- `concentrations` in network edge order;
- `cellConcentrations[edge][cell]`, cells in original edge orientation;
- `nodeConcentrations` in network node order;
- `injectedMassMg`, `storedMassMg`, `escapedMassMg`, `removedMassMg`;
- `massBalanceErrorMg = injected - stored - escaped - removed`.

The UI should select cached calculated frames when scrubbing. It should associate airflow arrows with `flowStateIndex`, show the concentration unit and identify any user-defined concentration marker. Reaching such a marker does not imply occupational exposure compliance. A remaining tail at the final time is still stored tracer, not automatically “cleared”.

## Verification and admission limits

The analytical tests compare against independently derived expressions:

| Case | Independent expectation |
|---|---|
| One mixed cell, pulse | `C(t)=M0/V * exp(-(Q/V+λ)t)` |
| One mixed cell, sustained source from zero | `C(t)=S/(Q+λV) * (1-exp(-(Q/V+λ)t))` while active |
| N equal cells, pulse in first, no loss | Stored fraction `exp(-a t) * sum((a t)^j/j!, j=0..N-1)`, `a=Q/Vcell` |
| Combined escape and loss | Removed and escaped fractions divide by rates `λ` and `Q/V` |
| Closed interval with no loss | Stored mass exactly constant |
| Fan-speed step in one cell | Exponent integrates piecewise `Q(t)/V` |

The one-cell fixture has Q=10 m³/s, V=100 m³ and M0=1000 mg. At 20 s without loss, its exact stored mass is 135.335283 mg. Time-refinement tests check approximately fourfold error reduction when halving the step. Other checks cover split/merge mixing, declared orientation reversal, actual scheduled crosscut reversal, symmetric interface sources, closure/reopening, boundary non-recycling and all twelve authored catalog networks.

At implementation verification, `npm test -- src/engine/transport.test.ts src/engine/routing.test.ts` passes 58 tests combined. This is numerical verification, not a field calibration or a UI deployment receipt. Re-run the command after modifying the engine.

Limits: existing network maximum 120 nodes/240 edges; 1–16 cells per airway; 2–301 output frames; at most 32 releases and 24 flow changes; duration 10⁻⁶–86400 s; loss coefficient 0–100 s⁻¹; pulse mass and source rate each at most 10¹² in their stated units. The exact segmented workload is estimated before integration. More than 200,000 steps or 40 million cell-steps is rejected with an actionable message. No requested discretization is silently weakened.

Malformed input throws a descriptive error. A validated but unsupported airflow equilibrium returns `completed:false`, the attempted flow states, an explanation and no concentration frames. An integration-budget rejection throws before advancing the field. The host should run accepted simulations in a worker and show these distinct outcomes.

Tracer studies are relevant to actual mine ventilation, but predictive use depends on measured geometry, ventilation states and tracer observations. The study by Jong and colleagues discusses underground tracer characterization; it does not validate Aerovia's authored examples. [Mining tracer study, NIOSH archive](https://stacks.cdc.gov/view/cdc/207736)

## Español: objetivo y modelo

La herramienta calcula el transporte de un trazador pasivo por una red de labores. Permite una inyección instantánea o una fuente sostenida, observar curvas de concentración y recorrer tiempos calculados. Un programa de velocidad, resistencia o cierre modifica el caudal y conserva el trazador ya presente. El resultado alimenta la visualización; no se obtiene cambiando solamente la velocidad de partículas decorativas.

Cada labor se divide en N celdas de igual volumen `V=A L/N`. La longitud L está en metros y proviene de sus extremos, salvo una longitud física explícita en `edgeLengths`. El área A está en m² y considera la modificación vigente. La masa m está en mg y la concentración `C=m/V`, en mg/m³. No se supone conversión a ppm. La geometría coincidente requiere una longitud explícita; valores inferiores a 10⁻⁶ m se rechazan sin sustituirlos automáticamente.

El modelo independiente adopta un balance de masa entre caudales, fuentes y sumideros. La separación entre equilibrio de aire y evolución de concentración tiene un referente metodológico en la teoría multizona de NIST; no equivale a implementar CONTAM. [Teoría de CONTAM](https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.1887r1.pdf)

La ecuación por celda es `dm/dt=F_entrada-F_salida+S-λm`, con flujo de trazador `F=abs(Q)*C_aguas_arriba`. La fuente S se expresa en mg/s y λ en s⁻¹. Por defecto λ=0. Un λ positivo representa una pérdida lineal definida por el usuario; no incorpora automáticamente química, toxicología o deposición calibrada.

En un nudo interno sin almacenamiento, se suman los flujos de trazador que llegan y se distribuyen entre las salidas en proporción a su caudal. La concentración del nudo es esa tasa de masa dividida por el caudal total de salida. Las fronteras de presión representan reservorios externos limpios: reciben masa que abandona el modelo y suministran aire con concentración cero. Para observar la concentración de salida, se consulta la última celda de la labor entrante, no el valor cero del nudo exterior.

Las celdas conservan siempre el orden declarado `from` → `to`. Un caudal negativo las recorre en sentido contrario. La posición de una fuente se mide respecto de ese orden original. Una fuente en una interfaz interna se reparte por mitades entre las dos celdas vecinas, de modo que invertir la declaración de la labor no desplaza artificialmente la fuente. Una labor cerrada o sin flujo mantiene su volumen y su masa. Al reabrirla, el material puede volver a desplazarse.

## Español: tiempo, controles y precisión

La integración usa dos etapas Runge–Kutta de segundo orden con conservación de positividad. Aplica `Δt*max(abs(Q)/V+λ)<=0.45`. Las tasas de masa que escapa y se elimina se integran con las mismas etapas que la masa de las celdas. Cada tramo termina exactamente en una salida solicitada, inyección, inicio/fin de fuente o cambio de operación. En un evento se termina el tramo anterior, se selecciona el nuevo caudal, se aplica la inyección y se guarda la salida. Una inyección en 10 s aparece en el cuadro de 10 s.

El esquema espacial representa mezcla completa dentro de cada celda y transporte hacia la celda siguiente. Produce dispersión numérica: aumentar N cambia esa dispersión. Una buena conservación de masa no demuestra por sí sola precisión temporal o espacial. Se deben comparar pasos menores mediante `maxStepSeconds` y una mayor cantidad de celdas. El número de cuadros también puede reducir el paso efectivo al introducir eventos adicionales.

Un programa de operación calcula equilibrios sucesivos y constantes por tramos. No calcula inercia del ventilador, ondas de presión, respuesta del actuador ni un campo CFD tridimensional. Cada evento entrega opciones completas; no hereda modificaciones omitidas del evento anterior. Los tiempos deben ser positivos y distintos. Cambiar área durante un programa se rechaza porque alteraría el volumen de almacenamiento; se pueden comparar ejecuciones separadas con áreas distintas.

## Español: resultados y verificación

`simulateTransport(network, options, request)` devuelve `aerovia.transport/v1`. Cada cuadro contiene tiempo, índice del estado de flujo, concentraciones de labores/celdas/nudos y el balance:

`error = masa_inyectada - masa_almacenada - masa_escapada - masa_eliminada`.

Todas esas masas están en mg. La consulta temporal debe seleccionar los cuadros calculados y asociar sus flechas al índice de flujo correspondiente. Un marcador de concentración elegido por el usuario sirve para comparar escenarios; no constituye un límite normativo incorporado. Una cola de masa al terminar la simulación sigue siendo material almacenado.

Las pruebas contrastan soluciones exponenciales de un volumen mezclado, fuente continua, supervivencia de Erlang para celdas en serie y fracciones independientes de pérdida/salida. También verifican refinamiento temporal, mezcla y bifurcaciones, caudal inverso, inversión real de una conexión mediante resistencias, cierre y reapertura, fronteras limpias y los doce escenarios del catálogo. Las 58 pruebas conjuntas de transporte y rutas pasan con el comando mostrado arriba; esto verifica los algoritmos, no una calibración de terreno.

El navegador admite hasta 120 nudos, 240 ramas, 16 celdas por rama, 301 cuadros, 32 fuentes, 24 cambios y 86400 s. Se rechazan más de 200000 pasos o 40 millones de actualizaciones de celda antes de integrar. La aplicación debe mostrar el error y permitir reducir la solicitud; no reducirla ocultamente. Un equilibrio no soportado devuelve `completed:false` sin concentraciones fabricadas. La interfaz debe ejecutar el cálculo admitido en un worker.

Los trazadores tienen aplicaciones reales en caracterización de ventilación subterránea; convertir estos resultados en predicción de una mina requiere entradas y observaciones medidas. Los ejemplos de Aerovia continúan siendo redes de autoría explícita. [Estudio minero conservado por NIOSH](https://stacks.cdc.gov/view/cdc/207736)
