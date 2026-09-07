# Physical Lab Serial Protocol v0.2

Transport:
- USB serial
- 115200 baud
- ASCII CSV
- one sample/event per line
- numeric acquisition lines only

Physical Lab v1 compatibility:
    float(line.split(',')[-1])

Therefore:
- final field must be numeric;
- final field is the current primary observable;
- earlier fields preserve useful timing/channels for a future schema-aware capture v2.

Time:
- periodic samplers use micros() where practical;
- rollover-safe unsigned subtraction is used for scheduling;
- event devices preserve event timestamps.

Scientific boundary:
capturing serial bytes does not establish sensor calibration, traceability,
alignment, uncertainty, environmental correction or model validity.
