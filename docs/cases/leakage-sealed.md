# Sealed leakage intervention

ID `leakage-sealed`; 45 nodes, 60 airways. It matches `leakage-open` exactly except all three `leakage-*` resistances become 18 Pa·s²/m⁶. The pathways remain active with finite leakage; sealing is not represented as a perfect mathematical closure.

Compare the corresponding working airways at speed 1. The regression suite verifies that this specified intervention increases every production working flow for this authored network. Compare the resulting electrical power as a calculation, then rerun common-speed target search to test whether the changed distribution allows a different setpoint.

This is a paired engineering scenario, not evidence of measured energy savings. The same supplied fan curve, efficiency and targets are retained so the resistance change can be assessed clearly.
