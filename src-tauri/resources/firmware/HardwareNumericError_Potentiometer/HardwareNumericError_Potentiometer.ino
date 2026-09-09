#include <Arduino.h>
#include <math.h>

// BetterBoard Hardware Numeric Error Depth 2 — Potentiometer / ADC
// A0 potentiometer. Studies sampled ADC evidence, exact requantization,
// oversampling statistics, and filter tracking. None of these establish
// calibrated voltage truth without an independent reference.

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif
#ifndef BB_OVERSAMPLE_COUNT
#define BB_OVERSAMPLE_COUNT 8
#endif
#ifndef BB_EMA_FAST_ALPHA
#define BB_EMA_FAST_ALPHA 0.35f
#endif
#ifndef BB_EMA_SLOW_ALPHA
#define BB_EMA_SLOW_ALPHA 0.08f
#endif

const uint8_t POT_PIN = A0;
const uint8_t PWM_PIN = 9;
const uint32_t SAMPLE_INTERVAL_US = (uint32_t)BB_SAMPLE_INTERVAL_US;
const uint8_t OVERSAMPLE_COUNT = (uint8_t)BB_OVERSAMPLE_COUNT;
const float EMA_FAST_ALPHA = (float)BB_EMA_FAST_ALPHA;
const float EMA_SLOW_ALPHA = (float)BB_EMA_SLOW_ALPHA;

uint32_t scheduledUs = 0;
uint32_t sampleIndex = 0;
float emaFast = 0.0f;
float emaSlow = 0.0f;
bool filtersReady = false;

uint16_t requantize10(uint16_t raw10, uint8_t bits) {
  const uint16_t levels = (uint16_t)((1U << bits) - 1U);
  // Integer round-to-nearest. 32-bit product is safe for 10 -> <=8 bits.
  return (uint16_t)(((uint32_t)raw10 * levels + 511UL) / 1023UL);
}

float reconstruct10(uint16_t q, uint8_t bits) {
  const uint16_t levels = (uint16_t)((1U << bits) - 1U);
  return ((float)q * 1023.0f) / (float)levels;
}

void setup() {
  Serial.begin(115200);
  pinMode(POT_PIN, INPUT);
  pinMode(PWM_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  scheduledUs = micros();
  Serial.println("sample_index,time_us,schedule_lateness_us,raw10,oversample_mean_counts,oversample_p2p_counts,q8,recon8_counts,q6,recon6_counts,q4,recon4_counts,ema_fast_counts,ema_slow_counts,pwm8");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - scheduledUs) < SAMPLE_INTERVAL_US) return;
  scheduledUs += SAMPLE_INTERVAL_US;
  const uint32_t actualUs = micros();
  const uint32_t latenessUs = (uint32_t)(actualUs - scheduledUs);

  uint32_t sum = 0;
  uint16_t minRaw = 1023;
  uint16_t maxRaw = 0;
  uint16_t raw = 0;
  const uint8_t n = OVERSAMPLE_COUNT > 0 ? OVERSAMPLE_COUNT : 1;
  for (uint8_t i = 0; i < n; ++i) {
    raw = (uint16_t)analogRead(POT_PIN);
    sum += raw;
    if (raw < minRaw) minRaw = raw;
    if (raw > maxRaw) maxRaw = raw;
  }
  const float meanCounts = (float)sum / (float)n;

  if (!filtersReady) {
    emaFast = meanCounts;
    emaSlow = meanCounts;
    filtersReady = true;
  } else {
    emaFast += EMA_FAST_ALPHA * (meanCounts - emaFast);
    emaSlow += EMA_SLOW_ALPHA * (meanCounts - emaSlow);
  }

  const uint16_t q8 = requantize10(raw, 8);
  const uint16_t q6 = requantize10(raw, 6);
  const uint16_t q4 = requantize10(raw, 4);
  const float r8 = reconstruct10(q8, 8);
  const float r6 = reconstruct10(q6, 6);
  const float r4 = reconstruct10(q4, 4);
  analogWrite(PWM_PIN, (uint8_t)q8);

  Serial.print(sampleIndex++); Serial.print(',');
  Serial.print(actualUs); Serial.print(',');
  Serial.print(latenessUs); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(meanCounts, 6); Serial.print(',');
  Serial.print((uint16_t)(maxRaw - minRaw)); Serial.print(',');
  Serial.print(q8); Serial.print(','); Serial.print(r8, 6); Serial.print(',');
  Serial.print(q6); Serial.print(','); Serial.print(r6, 6); Serial.print(',');
  Serial.print(q4); Serial.print(','); Serial.print(r4, 6); Serial.print(',');
  Serial.print(emaFast, 6); Serial.print(',');
  Serial.print(emaSlow, 6); Serial.print(',');
  Serial.println(q8);
}
