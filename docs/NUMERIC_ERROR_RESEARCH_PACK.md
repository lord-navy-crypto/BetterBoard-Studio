# BetterBoard Numeric Error Research Pack

This pack deepens BetterBoard's Numerical Bench with focused embedded experiments. It is intentionally small-hardware-first: most experiments need only the UNO; the hardware experiments use the user's existing potentiometer, photogate/encoder module, PIR module, switch and LED.

## Experiments

### 1. ADC Stability

Firmware: `NumericError_ADCStability`

Hardware: potentiometer on A0.

Measures one-second windows of raw ADC data and reports mean, min, max, peak-to-peak spread, population standard deviation and nominal mean voltage.

Question: when an analog input is held fixed, how much variation comes from the acquisition chain itself?

### 2. Requantization

Firmware: `NumericError_Quantization`

Hardware: potentiometer on A0.

Starts with the native 10-bit ADC and deliberately requantizes the same sample to 8, 6 and 4 bits. Each reduced representation is reconstructed into 10-bit-count space so the quantization error is explicit.

Question: how does reducing representation precision change the measured value?

### 3. Filter Lag

Firmware: `NumericError_FilterLag`

Hardware: potentiometer on A0.

Compares the raw nominal voltage with a fast EMA and a slow EMA. The serial output includes instantaneous filter residuals.

Question: how much noise reduction is purchased with dynamic lag?

### 4. Finite Difference

Firmware: `NumericError_Derivative`

Hardware: none.

Evaluates the derivative of `sin(x)` at `x=1` with forward and central differences while shrinking `h` from 1 to 1e-8. Reference is `cos(1)` evaluated by the MCU math library.

Question: why does smaller `h` eventually stop improving a finite-difference derivative in finite precision?

### 5. Numerical Integration

Firmware: `NumericError_Integration`

Hardware: none.

Integrates `sin(x)` on `[0, pi]`, whose analytic integral is 2, using left-rectangle, trapezoidal and Simpson rules for increasing subdivision counts.

Question: how do method order and discretization size affect convergence?

### 6. Floating-Point Summation

Firmware: `NumericError_Summation`

Hardware: none.

Compares naive repeated addition with Kahan compensated summation for a small repeated increment.

Question: how does rounding accumulate over many operations, and how much can compensated summation recover?

### 7. Photogate Timing

Firmware: `NumericError_PhotogateTiming`

Hardware: photogate / encoder-pulse module on D2.

Timestamps falling edges with `micros()` and reports period and frequency.

Question: how much event-to-event timing variation exists in a supposedly periodic mechanical/optical process, and how does period uncertainty propagate into frequency?

### 8. Switch Bounce

Firmware: `NumericError_SwitchBounce`

Hardware: push switch on D2 with `INPUT_PULLUP`.

Captures every edge in a short observation window and reports bounce duration and edge count.

Question: why does a physical binary switch not behave like an ideal mathematical step, and how should digital event measurements define a stable transition?

### 9. LED PWM Quantization

Firmware: `NumericError_PWMQuantization`

Hardware: potentiometer on A0 and LED on PWM D9 with an appropriate series resistor/module.

Maps the 10-bit ADC to 8-bit PWM, reconstructs the command back into 10-bit-count space and reports the representation error while the LED gives a visible output.

Question: what information is lost when a 10-bit control signal is reduced to an 8-bit actuator command?

### 10. Multi-Sensor Event Lab

Firmware: `NumericError_MultiSensorEventLab`

Suggested mapping:

- A0: potentiometer
- D2: photogate / encoder pulse
- D3: PIR
- D4: push switch
- D9: LED PWM

The program records analog value, nominal voltage, filtered voltage and filter residual; converts the analog command to 8-bit PWM; records PIR and switch state; and reports fresh photogate period/frequency observations.

This is not one 'accuracy number'. It is an evidence generator for mixed analog, digital and event-driven numerical analysis.

## Suggested research combinations

### Potentiometer + LED

Use the potentiometer as a continuous input and the LED PWM command as a deliberately lower-resolution actuator. Study 10-bit-to-8-bit quantization, dead bands, visible step size, filter lag and control mapping.

### Photogate + switch

Use the switch to mark trial boundaries and the photogate as the timestamp source. Study period repeatability, event quantization in microseconds, outlier rejection, and uncertainty propagation from period to frequency.

### PIR + LED

Use PIR rising/falling edges as slow event detections and the LED as a visible state indicator. Study latency, hold time, hysteresis-like behavior and the distinction between a physical event and the sensor's delayed digital representation.

### Photogate + LED

Use measured event frequency to drive LED brightness or blink rate. This creates a measurement-to-actuation pipeline where timing error, frequency conversion and output quantization can all be separated.

### Potentiometer + photogate + LED

Use the potentiometer as a user-defined reference or threshold, the photogate as the measured process, and the LED as an output indicator. This supports simple error-versus-reference experiments without claiming closed-loop physical control.

### Potentiometer + PIR + photogate + switch + LED

Use the switch to start/mark a trial, the potentiometer to choose a parameter/threshold, PIR as a coarse event channel, the photogate as a precise timing channel, and LED as state/output. BetterBoard can then compare analog sampling, event timing, quantization, filtering and digital-state uncertainty in one measurement package.

## Scientific boundary

- Nominal ADC voltage is not calibrated voltage unless the ADC reference/input path is characterized.
- The photogate's timestamp precision does not equal complete physical timing accuracy; geometry and sensor threshold matter.
- PIR modules are event sensors, not distance instruments.
- A switch-bounce experiment characterizes the switch/input path used in that setup; it is not a universal switch specification.
- LED brightness is not a calibrated optical-power measurement.
