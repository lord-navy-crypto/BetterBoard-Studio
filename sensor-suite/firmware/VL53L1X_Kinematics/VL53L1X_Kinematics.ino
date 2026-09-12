#include <Wire.h>
#include <Adafruit_VL53L1X.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif

Adafruit_VL53L1X tof;
unsigned long last_sample_us = 0;
float previous_x_m = 0.0f;
float previous_v_mps = 0.0f;
bool have_previous = false;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!tof.begin(0x29, &Wire)) while (true) delay(1000);
  if (!tof.startRanging()) while (true) delay(1000);
  tof.setTimingBudget(50);
}

void loop() {
  const unsigned long now = micros();
  const unsigned long elapsed = now - last_sample_us;
  if (elapsed < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  if (!tof.dataReady()) return;

  const int16_t distance_mm = tof.distance();
  tof.clearInterrupt();
  if (distance_mm < 0) return;

  const float x_m = distance_mm * 0.001f;
  const float dt = elapsed * 1.0e-6f;
  float v = 0.0f, a = 0.0f;
  if (have_previous && dt > 0.0f) {
    v = (x_m - previous_x_m) / dt;
    a = (v - previous_v_mps) / dt;
  } else {
    have_previous = true;
  }
  previous_x_m = x_m;
  previous_v_mps = v;

  Serial.print(now); Serial.print(',');
  Serial.print(distance_mm); Serial.print(',');
  Serial.print(x_m, 6); Serial.print(',');
  Serial.print(v, 6); Serial.print(',');
  Serial.println(a, 6);
}
