#include <Arduino.h>

// BetterBoard Numeric Error Depth — Quantization V2
// Re-quantizes the measured 10-bit ADC count to 8/6/4 bits using integer
// rational rounding so the experiment isolates quantization from float math.

const uint8_t ANALOG_PIN = A0;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 50000UL;
uint32_t nextSampleUs = 0;

uint16_t quantize10(uint16_t raw10, uint8_t bits) {
  const uint16_t levels = (1U << bits) - 1U;
  return (uint16_t)(((uint32_t)raw10 * levels + 511UL) / 1023UL);
}

float reconstructCounts(uint16_t q, uint8_t bits) {
  const uint16_t levels = (1U << bits) - 1U;
  return ((float)q * 1023.0f) / (float)levels;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  nextSampleUs = micros();
  Serial.println("sample_us,lateness_us,raw10,q8,recon8,error8_counts,q6,recon6,error6_counts,q4,recon4,error4_counts");
}

void loop() {
  const uint32_t now = micros();
  if ((int32_t)(now - nextSampleUs) < 0) return;
  const uint32_t scheduled = nextSampleUs;
  nextSampleUs += SAMPLE_INTERVAL_US;
  const uint32_t sampleUs = micros();
  const uint16_t raw = analogRead(ANALOG_PIN);
  const uint16_t q8 = quantize10(raw, 8), q6 = quantize10(raw, 6), q4 = quantize10(raw, 4);
  const float r8 = reconstructCounts(q8, 8), r6 = reconstructCounts(q6, 6), r4 = reconstructCounts(q4, 4);

  Serial.print(sampleUs); Serial.print(','); Serial.print(sampleUs - scheduled); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(q8); Serial.print(','); Serial.print(r8, 5); Serial.print(','); Serial.print(r8 - raw, 5); Serial.print(',');
  Serial.print(q6); Serial.print(','); Serial.print(r6, 5); Serial.print(','); Serial.print(r6 - raw, 5); Serial.print(',');
  Serial.print(q4); Serial.print(','); Serial.print(r4, 5); Serial.print(','); Serial.println(r4 - raw, 5);
}
