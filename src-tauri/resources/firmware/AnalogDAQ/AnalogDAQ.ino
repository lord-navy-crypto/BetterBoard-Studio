// BetterBoard Bench 01 — Analog Control & Instrumentation
// Parameter overrides are injected by BetterBoard before compilation.
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000
#endif
#ifndef BB_NOMINAL_ADC_REFERENCE_V
#define BB_NOMINAL_ADC_REFERENCE_V 5.0
#endif
#ifndef BB_ADC_MIN_COUNTS
#define BB_ADC_MIN_COUNTS 0
#endif
#ifndef BB_ADC_MAX_COUNTS
#define BB_ADC_MAX_COUNTS 1023
#endif
#ifndef BB_FILTER_ALPHA
#define BB_FILTER_ALPHA 0.20
#endif

const uint8_t ANALOG_PIN = A0;
const uint8_t PWM_PIN = 9;
const uint8_t STATUS_LED_PIN = LED_BUILTIN;
const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
const float NOMINAL_ADC_REFERENCE_V = (float)BB_NOMINAL_ADC_REFERENCE_V;
const int ADC_MIN_COUNTS = (int)BB_ADC_MIN_COUNTS;
const int ADC_MAX_COUNTS = (int)BB_ADC_MAX_COUNTS;
const float FILTER_ALPHA = (float)BB_FILTER_ALPHA;

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
