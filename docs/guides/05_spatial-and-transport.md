# 05. Design, operate and inspect transport

## Build or load a design

Choose one of the twelve authored cases and open its question-mark guide for its topology, physical assumptions and operating regimes. **New** creates a named network with a pressure boundary and an initial airway. **Draw** extends the selected junction onto the displayed edit-elevation plane; **Connect** joins two selected existing junctions. Crossings remain separate unless explicitly split and connected. Use **Move** to drag the selected junction's axis handle, or enter exact X/Y/Z coordinates. Coordinates are metres with Z up. Undo and redo include geometry and operating edits.

Select a tunnel in the scene or the **Network tables** dialog. Edit its type, area, resistance, forward-flow target or level. **Split** makes a real intermediate junction and conserves the entered series resistance; a fan split retains one fan. **Fan** equips the selected tunnel, with its editable curve under operating inputs. The visual width multiplier, level separation, camera and cut affect presentation only. Physical area affects velocity and tracer volume; resistance remains an independent engineering input.

**Load** accepts a validated network or portable project JSON, or separate node and airway CSV tables. Review each mapping and coordinate/area unit choice before loading. Coordinate feet convert to metres and square feet to square metres; resistance and pressure remain the explicitly labelled SI quantities. Duplicate IDs, missing endpoints, malformed numeric cells and invalid boundaries reject the import without replacing current work. See [table import](../methods/table-import.md).

**Save** exports project inputs and a recoverable baseline. Local storage also preserves work on this device. Export a file for durable transfer between devices. In **Network tables**, export node/airway inputs and inspect the current signed solution. No design data is transmitted to a server.

## Ask an operating question

**Airflow & paths** displays signed flow, velocity, pressure or target delivery. Pick a source and destination for a directed route through actual positive airflow. The reported sum of airway volume/flow is a nominal transit proxy, not first tracer arrival or a human travel time. Stagnant or disconnected destinations remain unreachable.

**Fan operations** provides the fan operating point, a 21-solution speed sweep, bounded common-speed optimization, resistance sensitivity and saved-baseline comparison. Optimization reports unsupported assumptions separately from failed solves and bounded infeasibility. Enter annual hours and a tariff in your chosen currency for constant-duty energy and cost; fixed charges and other mine loads are excluded. Sensitivity rankings and baseline differences are linked to the mine.

**Uncertainty** shows the canonical CUDA ensemble only when inputs exactly match that recorded case. Select a branch in the interval plot to inspect it spatially. Edited designs need their own [local uncertainty bake](03_gpu.md). **Learned screening** runs both actual ONNX models, reports errors against the current numerical reference, and permits an explicitly labelled predicted field only inside the trained domain. Imported or modified topologies may be outside that domain; the numerical solver remains available.

## Compute a tracer history

1. Open **Tracer transport**, select a release airway in the scene and choose **Use selected tunnel**.
2. Choose a pulse mass or a continuous release with total mass and duration. Set start time and simulation duration.
3. Optionally schedule a common fan-speed change and airway closure. This assumes immediate equilibrium airflow at the scheduled time, with tracer mass retained.
4. Select **Simulate transport**. Failed or over-budget runs show the actual reason. Running work can be cancelled.
5. Play, pause or scrub calculated time. Tunnel-cell colors use one scale over the whole run. Pick a tunnel to link its volume-averaged concentration history, then click the plot to select a calculated frame.
6. Inspect injected, stored, escaped, removed and balance-error mass. **Export time series** retains the network, initial options, exact transport request and every output frame.

This is passive scalar transport in mixed cells. It does not calculate heat, combustion, toxicology, emergency response or three-dimensional turbulent flow. See the [equations and limits](../methods/transport.md) and [directed-path definition](../methods/routing.md).

## Reproduce or extend the timeline locally

Node 24 and the frontend dependencies run the same TypeScript numerical transport implementation without a browser. From the repository root:

```powershell
npm --prefix frontend run transport -- --input ../data/cases.json --case hard-rock --duration 300 --mass 10000 --output ../build/local/tracer.json
```

The npm command runs in `frontend/`, so file arguments above are relative to that directory. A complete JSON request supports 1-16 cells per airway, up to 32 releases, 24 scheduled changes, measured edge-length overrides, first-order loss and smaller time steps for refinement studies. Inspect the request schema in [transport documentation](../methods/transport.md). Exported replay `request` can be saved as a standalone request file:

```powershell
npm --prefix frontend run transport -- --input ../build/local/design-project.json --request ../build/local/timeline.json --routeSource intake-0 --routeTarget return-0 --output ../build/local/tracer-with-route.json
```

The CLI validates the network and full timeline, enforces work limits, records the input-file SHA-256 and writes atomically after a complete calculation. Invalid requests preserve an existing output. The checked three-level pulse produced 151 frames/600 steps with maximum mass-balance error below 8e-12 mg; this is a numerical conservation measurement, not evidence of field accuracy.

## Español: recorrido operativo

Abra la guía del caso antes de interpretar sus objetivos. **Nuevo**, **Dibujar**, **Conectar**, **Mover** y **Dividir** cambian la red real; las coordenadas usan metros y Z hacia arriba. Una intersección visual no crea una unión automáticamente. La separación de niveles, el ancho visual y el corte solo cambian la presentación. **Cargar** valida proyectos o tablas independientes de uniones/galerías, con mapeo y conversión explícita de unidades, y conserva el trabajo previo si encuentra errores. **Guardar** produce una copia portátil; los datos permanecen en el dispositivo.

En **Operación**, compare puntos de ventilador, barridos, sensibilidad, objetivos y una referencia guardada. Las horas y la tarifa determinan el costo anual a régimen constante. **Incertidumbre** pertenece exclusivamente a los datos canónicos registrados; una edición exige otro cálculo local. **Modelos aprendidos** ejecuta aproximaciones ONNX reales y rechaza entradas fuera del dominio; siempre compare residuos y errores con la referencia numérica.

En **Transporte**, seleccione la galería emisora, configure pulso o emisión continua y, si corresponde, un cambio programado. Ejecute y recorra el tiempo calculado: los colores de las celdas, el monitor seleccionado y el balance de masa corresponden al mismo instante. La exportación incluye entradas y solicitud completa para reproducirla. El trazador es pasivo; no representa incendios, exposición humana ni respuesta de emergencia. Los comandos locales anteriores permiten refinamiento espacial/temporal, pérdidas de primer orden, varias fuentes y cambios sucesivos bajo los límites documentados.
