#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000
#endif

Adafruit_MPU6050 mpu;
const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;
bool have_previous = false;
float previous_gx = 0.0f;
float theta_rectangle_rad = 0.0f;
float theta_trapezoid_rad = 0.0f;

void setup() {
  Serial.begin(115200);
  if (!mpu.begin()) {
    while (1) delay(100);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  const unsigned long dt_us = have_previous ? (unsigned long)(now - last_sample_us) : 0UL;
  last_sample_us = now;

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  const float dt_s = dt_us * 1.0e-6f;
  if (have_previous && dt_s > 0.0f) {
    theta_rectangle_rad += previous_gx * dt_s;
    theta_trapezoid_rad += 0.5f * (previous_gx + g.gyro.x) * dt_s;
  }
  previous_gx = g.gyro.x;
  have_previous = true;

  Serial.print(now); Serial.print(',');
  Serial.print(a.acceleration.x, 6); Serial.print(',');
  Serial.print(a.acceleration.y, 6); Serial.print(',');
  Serial.print(a.acceleration.z, 6); Serial.print(',');
  Serial.print(g.gyro.x, 7); Serial.print(',');
  Serial.print(g.gyro.y, 7); Serial.print(',');
  Serial.print(g.gyro.z, 7); Serial.print(',');
  Serial.print(dt_s, 8); Serial.print(',');
  Serial.print(theta_rectangle_rad, 8); Serial.print(',');
  Serial.print(theta_trapezoid_rad, 8); Serial.print(',');
  Serial.println(theta_trapezoid_rad - theta_rectangle_rad, 8);
}
