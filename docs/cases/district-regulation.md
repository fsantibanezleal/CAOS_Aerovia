# Western district regulation

ID `district-regulation`; 34 nodes, 42 airways. This is the asymmetric twin-district network with the western entrance `west-supply-0` resistance raised from 0.028 to 0.24 Pa·s²/m⁶. All other inputs remain unchanged.

Compare `west-production-*` and `east-production-*` branch flows against the unregulated network at the same fan speed. Use the inspector to sweep the entrance resistance and look for the target tradeoff: reducing the favored district's flow can improve the constrained arm while creating a western deficit. Inspect the minimum target ratio and total electrical power together.

The regulator is an equivalent steady resistance. Gate position, mechanical geometry, actuator control and regulator-specific pressure coefficients require additional calibrated inputs and are not inferred.
