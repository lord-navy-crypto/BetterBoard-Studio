#include <Arduino.h>

const uint8_t ANALOG_PIN = A0;
const uint8_t LED_PWM_PIN = 9;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 50000UL;
uint32_t lastSampleUs = 0;

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  pinMode(LED_PWM_PIN, OUTPUT);
  Serial.println("time_us,raw10,normalized,pwm8,reconstructed10,error_counts");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - lastSampleUs) < SAMPLE_INTERVAL_US) return;
  lastSampleUs += SAMPLE_INTERVAL_US;

  const int raw = analogRead(ANALOG_PIN);
  const float normalized = raw / 1023.0f;
  const int pwm = (int)(normalized * 255.0f + 0.5f);
  const float reconstructed = pwm * 1023.0f / 255.0f;
  const float error = reconstructed - raw;
  analogWrite(LED_PWM_PIN, pwm);

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(normalized, 6); Serial.print(',');
  Serial.print(pwm); Serial.print(',');
  Serial.print(reconstructed, 4); Serial.print(',');
  Serial.println(error, 4);
}
