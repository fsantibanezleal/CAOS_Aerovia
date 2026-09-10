# Network authoring transactions

The editor operates on the same versioned network contract as the independent numerical solver. A drawing transaction connects an existing junction to another junction or a newly positioned endpoint. It never infers connectivity from overlapping screen pixels. Coordinate movement changes the geometric path, while airway resistance remains an independent engineering input unless a separate explicitly selected calculation changes it.

All transactions construct and validate a new graph before committing it. Invalid identifiers, nonfinite coordinates, invalid equipment parameters and components without a pressure reference fail without changing the current project. The starter design has one surface pressure reference and an initial shaft; it has no fan and therefore makes no promise of useful ventilation until equipment and a connected flow path are designed.

Splitting an airway at fraction f partitions its original resistance into fR and (1-f)R. Because both segments carry the same signed flow, their total pressure loss remains R Q |Q|. Fan equipment remains on only the original segment; a downstream planning target remains one target. This is a series-network construction, not a geometric calibration of actual rock friction. The transaction tests compare the resulting network solve with the unsplit graph.

Before changing topology, per-airway area, target and resistance overrides are materialized into the graph. The global speed and resistance multipliers remain separate operating settings, and closure overrides are retained. This prevents accidentally applying a branch modification twice or losing it when splitting or drawing.

The direct-manipulation workflow follows the domain distinction between edit-plane geometry and connection identity described in the [Ventsim official manual](https://www.ventsim.com/files/VentsimManual.pdf). The series pressure relation follows the network model described in [McPherson's ventilation text](https://www.srk.com/download/file/594). Aerovia's implementation is independent; no commercial-software equivalence or field validation is claimed.

## Español

Las transacciones de edición utilizan el mismo contrato de red que el motor numérico. Dibujar conecta una unión existente con otra unión o con un extremo nuevo. Una intersección visual no crea una conexión implícita. Mover coordenadas cambia la geometría; la resistencia sigue siendo una entrada de ingeniería independiente.

Cada operación construye y valida una copia antes de modificar el proyecto. Los identificadores inválidos, las coordenadas no finitas, los equipos mal definidos y los componentes sin referencia de presión producen un error sin alterar los datos actuales. El diseño inicial contiene una referencia superficial y un pique; no contiene un ventilador ni garantiza ventilación útil.

Al dividir una galería en la fracción f, sus resistencias pasan a ser fR y (1-f)R. Como circula el mismo caudal por ambos tramos, se conserva la pérdida total R Q |Q|. El ventilador y el objetivo de caudal no se duplican. Las modificaciones de área, resistencia y objetivo se incorporan antes de editar la topología; los factores globales y los cierres mantienen su significado original. Estas reglas tienen verificaciones numéricas y no constituyen una calibración de mina.
