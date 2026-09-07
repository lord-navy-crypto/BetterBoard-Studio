#include <math.h>

const unsigned long SAMPLE_INTERVAL_US = 20000UL; // 50 Hz
const float TEST_FREQUENCY_HZ = 0.5f;

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

  // time_us,value
  Serial.print(now);
  Serial.print(',');
  Serial.println(value, 6);
}
