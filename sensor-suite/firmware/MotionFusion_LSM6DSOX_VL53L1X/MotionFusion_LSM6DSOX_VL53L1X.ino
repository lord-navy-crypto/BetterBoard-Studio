#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_VL53L1X.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000
#endif

Adafruit_LSM6DSOX imu;
Adafruit_VL53L1X tof;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(300);
  }
}
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!imu.begin_I2C()) sensorFail();
  if (!tof.begin(0x29, &Wire)) sensorFail();
  if (!tof.startRanging()) sensorFail();

  imu.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_500_DPS);
  imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
  imu.setGyroDataRate(LSM6DS_RATE_104_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  if (!tof.dataReady()) return;
  last_sample_us = now;

  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temp;
  imu.getEvent(&accel, &gyro, &temp);

  const int16_t distance_mm = tof.distance();
  tof.clearInterrupt();
  if (distance_mm < 0) return;

  // time_us,distance_mm,ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads
  Serial.print(now);
  Serial.print(','); Serial.print(distance_mm);
  Serial.print(','); Serial.print(accel.acceleration.x, 6);
  Serial.print(','); Serial.print(accel.acceleration.y, 6);
  Serial.print(','); Serial.print(accel.acceleration.z, 6);
  Serial.print(','); Serial.print(gyro.gyro.x, 6);
  Serial.print(','); Serial.print(gyro.gyro.y, 6);
  Serial.print(','); Serial.print(gyro.gyro.z, 6);
  Serial.println();
}
