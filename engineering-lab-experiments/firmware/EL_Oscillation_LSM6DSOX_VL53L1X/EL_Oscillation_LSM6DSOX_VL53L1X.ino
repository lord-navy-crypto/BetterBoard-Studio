#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_VL53L1X.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif

Adafruit_LSM6DSOX imu;
Adafruit_VL53L1X tof;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(120);
    digitalWrite(LED_BUILTIN, LOW); delay(120);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!imu.begin_I2C()) failSensor();
  if (!tof.begin(0x29, &Wire)) failSensor();
  if (!tof.startRanging()) failSensor();
  sampler.arm(micros());
  stream.begin("el-oscillation-imu-tof",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,distance_m,ax_mps2,ay_mps2,az_mps2,gx_rps,gy_rps,gz_rps",
               "us,m,m/s^2,m/s^2,m/s^2,rad/s,rad/s,rad/s",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now) || !tof.dataReady()) return;

  const int16_t distance_mm = tof.distance();
  tof.clearInterrupt();
  if (distance_mm < 0) return;

  sensors_event_t a, g, temp;
  imu.getEvent(&a, &g, &temp);

  stream.rowBegin(now);
  stream.field(float(distance_mm) / 1000.0f, 6);
  stream.field(a.acceleration.x, 6); stream.field(a.acceleration.y, 6); stream.field(a.acceleration.z, 6);
  stream.field(g.gyro.x, 7); stream.field(g.gyro.y, 7); stream.field(g.gyro.z, 7);
  stream.rowEnd();
}
