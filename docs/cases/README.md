# Authored engineering case library

These twelve networks are transparent engineering scenarios authored for Aerovia under Apache-2.0. They are useful for reproducing a calculation, comparing interventions and learning the workflow. They are not surveyed or calibrated operating mines. Resistance, fan curves and targets are supplied design assumptions. No legal airflow target is implied.

Recreate identical input values with `python scripts/pipeline.py create`. Each case is stored in `data/cases.json`, and the corresponding accepted reference result, GPU uncertainty and checksum are in `data/artifacts`. Full source generation is in `data-pipeline/aerovia_pipeline/cases.py`. Coordinates use meters in an x/y plan and z elevation. Changing display level separation does not change the physical network.

| Case | Nodes / edges | Engineering question |
|---|---:|---|
| [Three-level production](hard-rock.md) | 45 / 57 | How do shared shafts redistribute flow between production levels? |
| [Five-level deep mine](deep-five-level.md) | 58 / 75 | How does additional depth challenge a common fan setting? |
| [Room-and-pillar district](room-pillar.md) | 27 / 42 | Which cross-passages short-circuit a gridded district? |
| [Asymmetric districts](twin-district.md) | 34 / 42 | How do unequal districts compete for shared pressure? |
| [Open leakage paths](leakage-open.md) | 45 / 60 | How much flow bypasses the workings? |
| [Sealed leakage intervention](leakage-sealed.md) | 45 / 60 | How does sealing change production flow and fan demand? |
| [Western district regulation](district-regulation.md) | 34 / 42 | Can regulating the easy district improve the difficult one? |
| [Development and auxiliary ducts](development-headings.md) | 35 / 42 | What supply reaches a long, narrow duct-to-face circuit? |
| [Return-shaft maintenance](return-restriction.md) | 45 / 57 | What does a shared return restriction do to all workings? |
| [Deep district booster](deep-booster.md) | 58 / 75 | How does a series booster alter deep flow and total power? |
| [Independent lower intake](split-intake.md) | 47 / 59 | How does a second fresh-air route change the lower horizon? |
| [Narrow-vein inclined mine](narrow-incline.md) | 36 / 45 | How does increasing working resistance affect deep targets? |

The paired cases deliberately retain identical unaffected inputs. Their topology or specific resistance changes are the experimental intervention; random seeds are never treated as a different physical case. Every case has signed forward targets that can expose an unmet requirement. A green numerical solve means conservation passed, not that every target is satisfied.
