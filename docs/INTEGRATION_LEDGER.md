# Physical Lab hardware-code integration ledger

This release merges the hardware-side code previously produced for Physical Lab into BetterBoard Studio.

| Earlier artifact | Integrated into v0.2 | Treatment |
|---|---|---|
| `PhysicalLab_UNO_Blink_Test.ino` | Yes | Canonical `blink` recipe |
| Measurement Pack v0.1 | Yes | Preserved in archive; later source revisions supersede duplicate firmware |
| Measurement Pack v0.2 | Yes | ADXL345 + Honeycomb analogue material preserved; archive kept |
| Measurement Pack v0.3 | Yes | Random Walk robot + Honeycomb material preserved; archive kept |
| Hardware Pack v0.4 | Yes | Canonical source for 9 hardware/diagnostic recipes |
| PHYSERIAL v0.2 | Yes | Embedded Physical Lab bridge documentation |
| USB connection notes | Yes | Embedded reference documentation |
| Physical Lab hardware mapping | Yes | Embedded bridge mapping |

The full Physical Lab numerical solvers are intentionally **not** duplicated into BetterBoard. Those are not hardware-driver code and remain owned by Physical Lab. BetterBoard exports measurements to them through the bridge.
