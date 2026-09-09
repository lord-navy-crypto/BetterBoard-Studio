#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000
#endif
#ifndef BB_TEST_FREQUENCY_HZ
#define BB_TEST_FREQUENCY_HZ 0.5
#endif

const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
const float TEST_FREQUENCY_HZ = (float)BB_TEST_FREQUENCY_HZ;
unsigned long last_sample_us = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  const float t = now / 1000000.0f;
  const float value = sin(2.0f * PI * TEST_FREQUENCY_HZ * t);
  Serial.print(now);
  Serial.print(',');
  Serial.println(value, 6);
}
