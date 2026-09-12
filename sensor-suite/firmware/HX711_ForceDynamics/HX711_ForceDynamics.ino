#include <HX711.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0L
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0f
#endif
#ifndef BB_FILTER_ALPHA
#define BB_FILTER_ALPHA 0.2f
#endif

HX711 scale;
const uint8_t HX_DOUT = 4;
const uint8_t HX_SCK = 5;
unsigned long last_sample_us = 0;
float filtered_force = 0.0f;
float previous_filtered_force = 0.0f;
bool have_previous = false;

void setup() {
  Serial.begin(115200);
  scale.begin(HX_DOUT, HX_SCK);
}

void loop() {
  const unsigned long now = micros();
  const unsigned long elapsed = now - last_sample_us;
  if (elapsed < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  if (!scale.is_ready()) return;

  const long raw = scale.read();
  const long corrected = raw - (long)BB_OFFSET_COUNTS;
  const float force_n = corrected / (float)BB_COUNTS_PER_NEWTON;
  if (!have_previous) {
    filtered_force = force_n;
    previous_filtered_force = force_n;
    have_previous = true;
  } else {
    filtered_force = (float)BB_FILTER_ALPHA * force_n + (1.0f - (float)BB_FILTER_ALPHA) * filtered_force;
  }
  const float dt = elapsed * 1.0e-6f;
  const float dfdt = dt > 0.0f ? (filtered_force - previous_filtered_force) / dt : 0.0f;
  previous_filtered_force = filtered_force;

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(force_n, 6); Serial.print(',');
  Serial.print(filtered_force, 6); Serial.print(',');
  Serial.println(dfdt, 6);
}
