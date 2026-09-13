# Engineering Lab v2 CI Contract

The v2 branch is accepted only when the same immutable PR head SHA satisfies all required repository workflows.

Required workflows:

- Engineering Lab Experiments
- BetterBoard C++ Core
- BetterBoard CI
- Sensor Suite v1 Integrity

The Engineering Lab workflow additionally compiles every catalog experiment for both Arduino UNO and ESP32-S3 and runs the fail-closed catalog/firmware schema self-check.

A green workflow from an older head does not count. If the head changes, the gate resets.
