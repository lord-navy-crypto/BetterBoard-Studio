#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

Adafruit_ADXL345_Unified accel1(34501);
Adafruit_ADXL345_Unified accel2(34502);
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
  if (!accel1.begin(0x53)) failSensor();
  if (!accel2.begin(0x1D)) failSensor();
  accel1.setRange(ADXL345_RANGE_16_G);
  accel2.setRange(ADXL345_RANGE_16_G);
  sampler.arm(micros());
  stream.begin("el-honeycomb-dual-adxl345",
               betterboard::experiments::target::MULTILAYER_HONEYCOMB_LATTICE,
               "time_us,a1_x_mps2,a1_y_mps2,a1_z_mps2,a2_x_mps2,a2_y_mps2,a2_z_mps2,sample_dt_us,sensor_skew_us,read_duration_us,quality_flags",
               "us,m/s^2,m/s^2,m/s^2,m/s^2,m/s^2,m/s^2,us,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;adxl1_address=0x53;adxl2_address=0x1D;range=16g;acquisition=sequential");
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const unsigned long sample_dt_us = previous_sample_us == 0 ? 0 : now - previous_sample_us;
  previous_sample_us = now;
  uint16_t quality = betterboard::experiments::evidence::Valid;
  if (sample_dt_us != 0 && sample_dt_us > BB_SAMPLE_INTERVAL_US + BB_SAMPLE_INTERVAL_US / 2) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::TimingLate);
  }

  const unsigned long read_start_us = micros();
  sensors_event_t e1, e2;
  accel1.getEvent(&e1);
  const unsigned long a1_done_us = micros();
  accel2.getEvent(&e2);
  const unsigned long a2_done_us = micros();
  const unsigned long sensor_skew_us = a2_done_us - a1_done_us;
  const unsigned long read_duration_us = a2_done_us - read_start_us;

  stream.rowBegin(now);
  stream.field(e1.acceleration.x, 6); stream.field(e1.acceleration.y, 6); stream.field(e1.acceleration.z, 6);
  stream.field(e2.acceleration.x, 6); stream.field(e2.acceleration.y, 6); stream.field(e2.acceleration.z, 6);
  stream.field(sample_dt_us); stream.field(sensor_skew_us); stream.field(read_duration_us);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
