#include <Wire.h>
#include <Adafruit_VL53L1X.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000
#endif

Adafruit_VL53L1X tof;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(180);
    digitalWrite(LED_BUILTIN, LOW);
    delay(180);
  }
}
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!tof.begin(0x29, &Wire)) sensorFail();
  if (!tof.startRanging()) sensorFail();
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  if (!tof.dataReady()) return;
  last_sample_us = now;

  const int16_t distance_mm = tof.distance();
  tof.clearInterrupt();
  if (distance_mm < 0) return;

  // time_us,distance_mm,distance_m
  Serial.print(now);
  Serial.print(',');
  Serial.print(distance_mm);
  Serial.print(',');
  Serial.println(float(distance_mm) / 1000.0f, 6);
}
