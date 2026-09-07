// BetterBoard Bench 01 — Analog Control & Instrumentation
// Canonical firmware for the existing analog_a0 recipe.
//
// Minimum hardware:
//   - UNO-compatible board
//   - potentiometer or other known-safe low-voltage analog source on A0
// Optional output:
//   - LED + suitable series resistor on PWM pin D9
//   - built-in LED is used as a simple >50% status indicator
//
// Serial contract @ 115200 baud, 50 Hz:
// time_us,raw_adc,normalized,nominal_voltage_v,pwm_command,filtered_voltage_v
//
// Scientific boundary:
// NOMINAL_ADC_REFERENCE_V is a nominal conversion only. Accurate voltage requires
// characterization/calibration of the real ADC reference and input path.

const uint8_t ANALOG_PIN = A0;
const uint8_t PWM_PIN = 9;
const uint8_t STATUS_LED_PIN = LED_BUILTIN;

const unsigned long SAMPLE_INTERVAL_US = 20000UL; // 50 Hz
const float NOMINAL_ADC_REFERENCE_V = 5.0f;

// Replace these endpoints after a two-point calibration if desired.
const int ADC_MIN_COUNTS = 0;
const int ADC_MAX_COUNTS = 1023;

// First-order exponential smoothing. 0 < alpha <= 1.
const float FILTER_ALPHA = 0.20f;

unsigned long last_sample_us = 0;
float filtered_voltage_v = 0.0f;
bool filter_initialized = false;

float clamp01(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 1.0f) return 1.0f;
  return value;
}

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  const int raw_adc = analogRead(ANALOG_PIN);
  const int span = ADC_MAX_COUNTS - ADC_MIN_COUNTS;
  const float normalized = span > 0
    ? clamp01((float)(raw_adc - ADC_MIN_COUNTS) / (float)span)
    : 0.0f;

  const float nominal_voltage_v = ((float)raw_adc / 1023.0f) * NOMINAL_ADC_REFERENCE_V;

  if (!filter_initialized) {
    filtered_voltage_v = nominal_voltage_v;
    filter_initialized = true;
  } else {
    filtered_voltage_v += FILTER_ALPHA * (nominal_voltage_v - filtered_voltage_v);
  }

  const int pwm_command = (int)(normalized * 255.0f + 0.5f);
  analogWrite(PWM_PIN, pwm_command);
  digitalWrite(STATUS_LED_PIN, normalized >= 0.5f ? HIGH : LOW);

  // Keep the primary observable last for BetterBoard / Physical Lab v1 compatibility.
  Serial.print(now);
  Serial.print(',');
  Serial.print(raw_adc);
  Serial.print(',');
  Serial.print(normalized, 6);
  Serial.print(',');
  Serial.print(nominal_voltage_v, 6);
  Serial.print(',');
  Serial.print(pwm_command);
  Serial.print(',');
  Serial.println(filtered_voltage_v, 6);
}
