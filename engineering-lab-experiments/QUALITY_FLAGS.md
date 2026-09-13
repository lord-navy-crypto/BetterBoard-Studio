# Engineering Lab v2 Quality Flags

`quality_flags` is a composable unsigned bitmask. A value of `0` means the firmware knows of no quality issue for that emitted row. Multiple bits may be set at once.

| Bit | Value | Name | Meaning |
|---:|---:|---|---|
| 0 | 1 | `SensorNotReady` | A sensor was not ready when evidence was requested. |
| 1 | 2 | `SensorError` | The sensor/API reported an invalid or failed measurement. |
| 2 | 4 | `TimingLate` | The observed sample interval materially exceeded the requested cadence. |
| 3 | 8 | `CalibrationDefault` | A default calibration/conversion constant is still in use. |
| 4 | 16 | `Saturated` | The measurement reached a known rail/range boundary. |
| 5 | 32 | `WarmingUp` | The measurement belongs to an explicitly identified warm-up state. |
| 6 | 64 | `DerivedUnavailable` | A derived quantity is not yet meaningful, for example a derivative on the first sample. |
| 7 | 128 | `EventDropped` | One or more input events were lost since the previous emitted event row. |

The bitmask reports firmware-observable acquisition conditions; it is not an uncertainty estimate and does not decide whether a scientific model is valid.
