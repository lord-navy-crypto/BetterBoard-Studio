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

unsigned long previous_sample_us = 0;

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
               "time_us,distance_m,ax_mps2,ay_mps2,az_mps2,gx_rps,gy_rps,gz_rps,sample_dt_us,sensor_skew_us,read_duration_us,quality_flags",
               "us,m,m/s^2,m/s^2,m/s^2,rad/s,rad/s,rad/s,us,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;imu=LSM6DSOX;tof=VL53L1X;tof_address=0x29;acquisition=sequential");
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now) || !tof.dataReady()) return;

  const unsigned long sample_dt_us = previous_sample_us == 0 ? 0 : now - previous_sample_us;
  previous_sample_us = now;
  uint16_t quality = betterboard::experiments::evidence::Valid;
  if (sample_dt_us != 0 && sample_dt_us > BB_SAMPLE_INTERVAL_US + BB_SAMPLE_INTERVAL_US / 2) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::TimingLate);
  }

  const unsigned long read_start_us = micros();
  const int16_t distance_mm = tof.distance();
  tof.clearInterrupt();
  const unsigned long tof_done_us = micros();

  sensors_event_t a, g, temp;
  imu.getEvent(&a, &g, &temp);
  const unsigned long imu_done_us = micros();
  const unsigned long sensor_skew_us = imu_done_us - tof_done_us;
  const unsigned long read_duration_us = imu_done_us - read_start_us;

  stream.rowBegin(now);
  if (distance_mm < 0) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::SensorError);
    stream.field("");
  } else {
    stream.field(float(distance_mm) / 1000.0f, 6);
  }
  stream.field(a.acceleration.x, 6); stream.field(a.acceleration.y, 6); stream.field(a.acceleration.z, 6);
  stream.field(g.gyro.x, 7); stream.field(g.gyro.y, 7); stream.field(g.gyro.z, 7);
  stream.field(sample_dt_us); stream.field(sensor_skew_us); stream.field(read_duration_us);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
