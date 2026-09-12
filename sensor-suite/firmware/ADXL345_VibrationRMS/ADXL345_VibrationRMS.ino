#include <Wire.h>
#include <Adafruit_ADXL345_U.h>
#include <Adafruit_Sensor.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(34501);
static unsigned long lastSample = 0;
static uint16_t n = 0;
static double sumSq = 0.0;
static float peak = 0.0f;

void setup() {
  Serial.begin(115200);
  if (!accel.begin()) while (true) delay(100);
  accel.setRange(ADXL345_RANGE_16_G);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  lastSample = now;

  sensors_event_t e;
  accel.getEvent(&e);
  const float mag = sqrtf(e.acceleration.x * e.acceleration.x + e.acceleration.y * e.acceleration.y + e.acceleration.z * e.acceleration.z);
  sumSq += (double)mag * (double)mag;
  if (mag > peak) peak = mag;
  n++;

  if (n >= BB_WINDOW_SAMPLES) {
    const float rms = sqrt(sumSq / n);
    Serial.print(now); Serial.print(',');
    Serial.print(rms, 5); Serial.print(',');
    Serial.print(peak, 5); Serial.print(',');
    Serial.println(n);
    n = 0; sumSq = 0.0; peak = 0.0f;
  }
}
