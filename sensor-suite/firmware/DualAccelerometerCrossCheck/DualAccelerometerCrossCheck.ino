#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <Adafruit_LSM6DSOX.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif

Adafruit_ADXL345_Unified adxl(34502);
Adafruit_LSM6DSOX imu;
unsigned long last_sample_us = 0;

void setup() {
  Serial.begin(115200);
  if (!adxl.begin()) while (true) delay(1000);
  if (!imu.begin_I2C()) while (true) delay(1000);
  adxl.setRange(ADXL345_RANGE_4_G);
  adxl.setDataRate(ADXL345_DATARATE_50_HZ);
  imu.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  sensors_event_t a1;
  sensors_event_t a2, gyro, temp;
  adxl.getEvent(&a1);
  imu.getEvent(&a2, &gyro, &temp);

  const float dx = a1.acceleration.x - a2.acceleration.x;
  const float dy = a1.acceleration.y - a2.acceleration.y;
  const float dz = a1.acceleration.z - a2.acceleration.z;
  const float disagreement = sqrtf(dx * dx + dy * dy + dz * dz);

  Serial.print(now); Serial.print(',');
  Serial.print(a1.acceleration.x, 6); Serial.print(',');
  Serial.print(a1.acceleration.y, 6); Serial.print(',');
  Serial.print(a1.acceleration.z, 6); Serial.print(',');
  Serial.print(a2.acceleration.x, 6); Serial.print(',');
  Serial.print(a2.acceleration.y, 6); Serial.print(',');
  Serial.print(a2.acceleration.z, 6); Serial.print(',');
  Serial.print(dx, 6); Serial.print(',');
  Serial.print(dy, 6); Serial.print(',');
  Serial.print(dz, 6); Serial.print(',');
  Serial.println(disagreement, 6);
}
