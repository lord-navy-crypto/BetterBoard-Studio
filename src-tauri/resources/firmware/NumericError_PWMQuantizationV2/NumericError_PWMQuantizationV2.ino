#include <Arduino.h>

// BetterBoard Numeric Error Depth — PWM Quantization V2
// Maps A0 10-bit counts to the UNO 8-bit PWM command using integer rounding.
// Reports reconstruction error in ADC-count space and the exact duty command.

const uint8_t ANALOG_PIN = A0;
const uint8_t PWM_PIN = 9;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 50000UL;
uint32_t nextSampleUs = 0;

uint8_t toPwm8(uint16_t raw10) {
  return (uint8_t)(((uint32_t)raw10 * 255UL + 511UL) / 1023UL);
}

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  pinMode(PWM_PIN, OUTPUT);
  nextSampleUs = micros();
  Serial.println("sample_us,lateness_us,raw10,pwm8,duty_fraction,reconstructed10,error_counts");
}

void loop() {
  const uint32_t now = micros();
  if ((int32_t)(now - nextSampleUs) < 0) return;
  const uint32_t scheduled = nextSampleUs;
  nextSampleUs += SAMPLE_INTERVAL_US;
  const uint32_t sampleUs = micros();
  const uint16_t raw = analogRead(ANALOG_PIN);
  const uint8_t pwm = toPwm8(raw);
  analogWrite(PWM_PIN, pwm);
  const float duty = (float)pwm / 255.0f;
  const float reconstructed = ((float)pwm * 1023.0f) / 255.0f;
  Serial.print(sampleUs); Serial.print(','); Serial.print(sampleUs - scheduled); Serial.print(',');
  Serial.print(raw); Serial.print(','); Serial.print(pwm); Serial.print(',');
  Serial.print(duty, 8); Serial.print(','); Serial.print(reconstructed, 6); Serial.print(',');
  Serial.println(reconstructed - raw, 6);
}
