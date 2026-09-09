#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Aliasing / Sampling Schedule V2
// A controlled 17 Hz synthetic signal is evaluated at the actual MCU sample
// timestamps. This keeps the source mathematically controlled while exposing
// real micros()-level scheduling lateness/jitter in the acquisition path.
// This is not an analog-front-end experiment.

const uint32_t BAUD = 115200;
const float SIGNAL_HZ = 17.0f;
const float TWO_PI_F = 6.2831853071795864769f;
const uint16_t SAMPLE_COUNTS = 64;

void runCase(uint16_t sampleRateHz) {
  const uint32_t periodUs = 1000000UL / sampleRateHz;
  const uint32_t startUs = micros();
  uint32_t nextUs = startUs;

  Serial.print("CASE,"); Serial.print(sampleRateHz); Serial.print(','); Serial.println(SIGNAL_HZ, 6);
  Serial.println("sample_rate_hz,sample_index,ideal_time_us,actual_time_us,lateness_us,value");

  for (uint16_t i = 0; i < SAMPLE_COUNTS; ++i) {
    while ((int32_t)(micros() - nextUs) < 0) {}

    const uint32_t actualUs = micros();
    const uint32_t idealRelUs = (uint32_t)i * periodUs;
    const uint32_t actualRelUs = actualUs - startUs;
    const int32_t latenessUs = (int32_t)(actualUs - nextUs);
    const float t = actualRelUs * 1e-6f;
    const float value = sinf(TWO_PI_F * SIGNAL_HZ * t);

    Serial.print(sampleRateHz); Serial.print(',');
    Serial.print(i); Serial.print(',');
    Serial.print(idealRelUs); Serial.print(',');
    Serial.print(actualRelUs); Serial.print(',');
    Serial.print(latenessUs); Serial.print(',');
    Serial.println(value, 8);

    nextUs += periodUs;
  }
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("NUMERIC_ERROR_ALIASING_V2");
  Serial.println("NOTE,controlled_synthetic_signal_sampled_on_real_mcu_schedule");
  const uint16_t rates[] = {200, 80, 40, 34, 30, 20};
  for (uint8_t i = 0; i < sizeof(rates) / sizeof(rates[0]); ++i) runCase(rates[i]);
  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
