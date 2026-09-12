#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000
#endif

Adafruit_LSM6DSOX imu;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(120);
    digitalWrite(LED_BUILTIN, LOW);
    delay(120);
  }
}
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!imu.begin_I2C()) sensorFail();

  imu.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_500_DPS);
  imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
  imu.setGyroDataRate(LSM6DS_RATE_104_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temp;
  imu.getEvent(&accel, &gyro, &temp);

  const float ax = accel.acceleration.x;
  const float ay = accel.acceleration.y;
  const float az = accel.acceleration.z;
  const float gx = gyro.gyro.x;
  const float gy = gyro.gyro.y;
  const float gz = gyro.gyro.z;
  const float amag = sqrtf(ax * ax + ay * ay + az * az);
  const float gmag = sqrtf(gx * gx + gy * gy + gz * gz);

  // time_us,ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads,temp_c,accel_mag_mps2,gyro_mag_rads
  Serial.print(now);
  Serial.print(','); Serial.print(ax, 6);
  Serial.print(','); Serial.print(ay, 6);
  Serial.print(','); Serial.print(az, 6);
  Serial.print(','); Serial.print(gx, 6);
  Serial.print(','); Serial.print(gy, 6);
  Serial.print(','); Serial.print(gz, 6);
  Serial.print(','); Serial.print(temp.temperature, 3);
  Serial.print(','); Serial.print(amag, 6);
  Serial.print(','); Serial.println(gmag, 6);
}
