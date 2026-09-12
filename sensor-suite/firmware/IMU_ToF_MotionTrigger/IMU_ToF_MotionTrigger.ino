#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_VL53L1X.h>
#include <Adafruit_Sensor.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif
#ifndef BB_TRIGGER_DELTA_MPS2
#define BB_TRIGGER_DELTA_MPS2 1.5f
#endif

Adafruit_LSM6DSOX imu;
Adafruit_VL53L1X tof;
static unsigned long lastSample = 0;
static float baselineMag = 9.80665f;
static bool baselineReady = false;
static uint16_t baselineCount = 0;
static double baselineSum = 0.0;

void setup() {
  Serial.begin(115200);
  if (!imu.begin_I2C()) while (true) delay(100);
  if (!tof.begin(0x29, &Wire)) while (true) delay(100);
  if (!tof.startRanging()) while (true) delay(100);
  imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  lastSample = now;

  sensors_event_t accel, gyro, temp;
  imu.getEvent(&accel, &gyro, &temp);
  const float amag = sqrtf(accel.acceleration.x * accel.acceleration.x + accel.acceleration.y * accel.acceleration.y + accel.acceleration.z * accel.acceleration.z);

  if (!baselineReady) {
    baselineSum += amag;
    baselineCount++;
    if (baselineCount >= 50) {
      baselineMag = baselineSum / baselineCount;
      baselineReady = true;
    }
  }

  int16_t distanceMm = -1;
  if (tof.dataReady()) {
    distanceMm = tof.distance();
    tof.clearInterrupt();
  }
  const float delta = amag - baselineMag;
  const int triggered = (baselineReady && fabsf(delta) >= BB_TRIGGER_DELTA_MPS2) ? 1 : 0;

  Serial.print(now); Serial.print(',');
  Serial.print(distanceMm); Serial.print(',');
  Serial.print(amag, 5); Serial.print(',');
  Serial.print(delta, 5); Serial.print(',');
  Serial.print(triggered); Serial.print(',');
  Serial.println(baselineReady ? 1 : 0);
}
