#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Aliasing / Sampling Rate
// Synthetic signal on the MCU so the sampling process is controlled.
// Produces samples at several rates for the same known-frequency sine wave.

const uint32_t BAUD = 115200;
const float SIGNAL_HZ = 17.0f;
const float TWO_PI_F = 6.2831853071795864769f;
const uint16_t SAMPLE_COUNTS = 64;

void runCase(uint16_t sampleRateHz) {
  const uint32_t dtUs = 1000000UL / sampleRateHz;
  uint32_t tUs = 0;
  Serial.print("CASE,"); Serial.print(sampleRateHz); Serial.print(','); Serial.println(SIGNAL_HZ, 6);
  Serial.println("sample_rate_hz,sample_index,time_us,value");
  for (uint16_t i = 0; i < SAMPLE_COUNTS; ++i) {
    const float t = tUs * 1e-6f;
    const float value = sinf(TWO_PI_F * SIGNAL_HZ * t);
    Serial.print(sampleRateHz); Serial.print(',');
    Serial.print(i); Serial.print(',');
    Serial.print(tUs); Serial.print(',');
    Serial.println(value, 8);
    tUs += dtUs;
  }
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("NUMERIC_ERROR_ALIASING_V1");
  const uint16_t rates[] = {200, 80, 40, 34, 30, 20};
  for (uint8_t i = 0; i < sizeof(rates)/sizeof(rates[0]); ++i) runCase(rates[i]);
  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
