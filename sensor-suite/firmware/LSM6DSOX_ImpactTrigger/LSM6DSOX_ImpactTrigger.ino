#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_Sensor.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 5000UL
#endif
#ifndef BB_TRIGGER_THRESHOLD_MPS2
#define BB_TRIGGER_THRESHOLD_MPS2 15.0f
#endif

Adafruit_LSM6DSOX imu;
static unsigned long lastSample = 0;

void setup() {
  Serial.begin(115200);
  if (!imu.begin_I2C()) while (true) delay(100);
  imu.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
  imu.setAccelDataRate(LSM6DS_RATE_208_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  lastSample = now;

  sensors_event_t accel, gyro, temp;
  imu.getEvent(&accel, &gyro, &temp);
  const float mag = sqrtf(accel.acceleration.x * accel.acceleration.x + accel.acceleration.y * accel.acceleration.y + accel.acceleration.z * accel.acceleration.z);
  const int triggered = mag >= BB_TRIGGER_THRESHOLD_MPS2 ? 1 : 0;

  Serial.print(now); Serial.print(',');
  Serial.print(accel.acceleration.x, 5); Serial.print(',');
  Serial.print(accel.acceleration.y, 5); Serial.print(',');
  Serial.print(accel.acceleration.z, 5); Serial.print(',');
  Serial.print(mag, 5); Serial.print(',');
  Serial.println(triggered);
}
