#include <HX711.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000
#endif
#ifndef BB_HX711_DATA_PIN
#define BB_HX711_DATA_PIN 3
#endif
#ifndef BB_HX711_CLOCK_PIN
#define BB_HX711_CLOCK_PIN 2
#endif
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0
#endif
#ifndef BB_AVERAGE_SAMPLES
#define BB_AVERAGE_SAMPLES 5
#endif

HX711 scale;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;
}

void setup() {
  Serial.begin(115200);
  scale.begin(BB_HX711_DATA_PIN, BB_HX711_CLOCK_PIN);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  if (!scale.is_ready()) return;
  last_sample_us = now;

  const long raw = scale.read_average(BB_AVERAGE_SAMPLES);
  const long corrected = raw - (long)BB_OFFSET_COUNTS;
  const float force_n = float(corrected) / float(BB_COUNTS_PER_NEWTON);

  // time_us,raw_counts,corrected_counts,force_n
  Serial.print(now);
  Serial.print(','); Serial.print(raw);
  Serial.print(','); Serial.print(corrected);
  Serial.print(','); Serial.println(force_n, 6);
}
