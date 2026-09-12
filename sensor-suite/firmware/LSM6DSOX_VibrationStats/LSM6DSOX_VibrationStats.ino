#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 50
#endif

Adafruit_LSM6DSOX imu;
unsigned long last_sample_us = 0;
unsigned int n = 0;
double accel_mean = 0.0, accel_m2 = 0.0;
double gyro_mean = 0.0, gyro_m2 = 0.0;

void setup() {
  Serial.begin(115200);
  if (!imu.begin_I2C()) while (true) delay(1000);
  imu.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_500_DPS);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  sensors_event_t accel, gyro, temp;
  imu.getEvent(&accel, &gyro, &temp);
  const double amag = sqrt(accel.acceleration.x * accel.acceleration.x + accel.acceleration.y * accel.acceleration.y + accel.acceleration.z * accel.acceleration.z);
  const double gmag = sqrt(gyro.gyro.x * gyro.gyro.x + gyro.gyro.y * gyro.gyro.y + gyro.gyro.z * gyro.gyro.z);

  ++n;
  double da = amag - accel_mean; accel_mean += da / n; accel_m2 += da * (amag - accel_mean);
  double dg = gmag - gyro_mean; gyro_mean += dg / n; gyro_m2 += dg * (gmag - gyro_mean);

  if (n >= (unsigned int)BB_WINDOW_SAMPLES) {
    const double astd = n > 1 ? sqrt(accel_m2 / (n - 1)) : 0.0;
    const double gstd = n > 1 ? sqrt(gyro_m2 / (n - 1)) : 0.0;
    Serial.print(now); Serial.print(',');
    Serial.print(n); Serial.print(',');
    Serial.print(accel_mean, 6); Serial.print(',');
    Serial.print(astd, 6); Serial.print(',');
    Serial.print(gyro_mean, 6); Serial.print(',');
    Serial.println(gstd, 6);
    n = 0; accel_mean = accel_m2 = gyro_mean = gyro_m2 = 0.0;
  }
}
