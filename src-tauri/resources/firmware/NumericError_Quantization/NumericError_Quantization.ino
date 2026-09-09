#include <Arduino.h>

const uint8_t ANALOG_PIN = A0;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 50000UL;
uint32_t lastSampleUs = 0;

uint16_t quantize(uint16_t raw10, uint8_t bits) {
  const uint16_t levels = (1U << bits) - 1U;
  const float normalized = (float)raw10 / 1023.0f;
  return (uint16_t)(normalized * levels + 0.5f);
}

float reconstructCounts(uint16_t q, uint8_t bits) {
  const uint16_t levels = (1U << bits) - 1U;
  return ((float)q / (float)levels) * 1023.0f;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  Serial.println("time_us,raw10,q8,recon8,error8_counts,q6,recon6,error6_counts,q4,recon4,error4_counts");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - lastSampleUs) < SAMPLE_INTERVAL_US) return;
  lastSampleUs += SAMPLE_INTERVAL_US;

  const uint16_t raw = analogRead(ANALOG_PIN);
  const uint16_t q8 = quantize(raw, 8);
  const uint16_t q6 = quantize(raw, 6);
  const uint16_t q4 = quantize(raw, 4);
  const float r8 = reconstructCounts(q8, 8);
  const float r6 = reconstructCounts(q6, 6);
  const float r4 = reconstructCounts(q4, 4);

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(q8); Serial.print(','); Serial.print(r8, 4); Serial.print(','); Serial.print(r8 - raw, 4); Serial.print(',');
  Serial.print(q6); Serial.print(','); Serial.print(r6, 4); Serial.print(','); Serial.print(r6 - raw, 4); Serial.print(',');
  Serial.print(q4); Serial.print(','); Serial.print(r4, 4); Serial.print(','); Serial.println(r4 - raw, 4);
}
