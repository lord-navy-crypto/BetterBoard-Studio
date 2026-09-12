#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_Sensor.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
#ifndef BB_ALPHA
#define BB_ALPHA 0.98f
#endif

Adafruit_LSM6DSOX imu;
static unsigned long lastSample = 0;
static float rollDeg = 0.0f;
static float pitchDeg = 0.0f;
static bool initialized = false;

void setup() {
  Serial.begin(115200);
  if (!imu.begin_I2C()) while (true) delay(100);
  imu.setAccelRange(LSM6DS_ACCEL_RANGE_4_G);
  imu.setGyroRange(LSM6DS_GYRO_RANGE_500_DPS);
  imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
  imu.setGyroDataRate(LSM6DS_RATE_104_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  const float dt = initialized ? (float)(now - lastSample) / 1000000.0f : 0.0f;
  lastSample = now;

  sensors_event_t accel, gyro, temp;
  imu.getEvent(&accel, &gyro, &temp);
  const float accelRoll = atan2f(accel.acceleration.y, accel.acceleration.z) * 180.0f / PI;
  const float accelPitch = atan2f(-accel.acceleration.x, sqrtf(accel.acceleration.y * accel.acceleration.y + accel.acceleration.z * accel.acceleration.z)) * 180.0f / PI;

  if (!initialized) {
    rollDeg = accelRoll;
    pitchDeg = accelPitch;
    initialized = true;
  } else {
    const float gyroRollRateDeg = gyro.gyro.x * 180.0f / PI;
    const float gyroPitchRateDeg = gyro.gyro.y * 180.0f / PI;
    rollDeg = BB_ALPHA * (rollDeg + gyroRollRateDeg * dt) + (1.0f - BB_ALPHA) * accelRoll;
    pitchDeg = BB_ALPHA * (pitchDeg + gyroPitchRateDeg * dt) + (1.0f - BB_ALPHA) * accelPitch;
  }

  Serial.print(now); Serial.print(',');
  Serial.print(accelRoll, 4); Serial.print(',');
  Serial.print(accelPitch, 4); Serial.print(',');
  Serial.print(rollDeg, 4); Serial.print(',');
  Serial.print(pitchDeg, 4); Serial.print(',');
  Serial.print(gyro.gyro.x, 5); Serial.print(',');
  Serial.println(gyro.gyro.y, 5);
}
