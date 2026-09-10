# Deep district booster

ID `deep-booster`; 58 nodes, 75 airways. It matches `deep-five-level`, except `intake-shaft-4` includes a series booster with H0=900 Pa, k=0.04 Pa·s²/m⁶ and efficiency 0.76. The original exhaust fan remains present.

Compare lower-horizon flow with the baseline five-level network, then inspect combined electrical demand. The common speed slider scales both fan curves simultaneously; it is not independent fan dispatch. Check the supported fan regime before accepting a scenario: reverse flow through a fan or negative delivered fan pressure is rejected explicitly.

The booster illustrates an authored pressure intervention and its distribution tradeoff. It does not model fan installation clearances, recirculation near the station, transient interactions or stall curves.
