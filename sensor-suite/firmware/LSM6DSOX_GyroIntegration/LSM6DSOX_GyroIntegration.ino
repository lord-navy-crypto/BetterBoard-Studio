#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

Adafruit_LSM6DSOX imu;
unsigned long last_sample_us = 0;
float previous_gz = 0.0f;
float theta_rect = 0.0f;
float theta_trap = 0.0f;
bool have_previous = false;

void setup() {
  Serial.begin(115200);
  if (!imu.begin_I2C()) while (true) delay(1000);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_500_DPS);
}

void loop() {
  const unsigned long now = micros();
  const unsigned long elapsed = now - last_sample_us;
  if (elapsed < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  sensors_event_t accel, gyro, temp;
  imu.getEvent(&accel, &gyro, &temp);
  const float gz = gyro.gyro.z;
  const float dt = elapsed * 1.0e-6f;

  if (have_previous) {
    theta_rect += gz * dt;
    theta_trap += 0.5f * (previous_gz + gz) * dt;
  } else {
    have_previous = true;
  }
  previous_gz = gz;

  Serial.print(now); Serial.print(',');
  Serial.print(gz, 7); Serial.print(',');
  Serial.print(dt, 7); Serial.print(',');
  Serial.print(theta_rect, 7); Serial.print(',');
  Serial.print(theta_trap, 7); Serial.print(',');
  Serial.println(theta_rect - theta_trap, 7);
}
