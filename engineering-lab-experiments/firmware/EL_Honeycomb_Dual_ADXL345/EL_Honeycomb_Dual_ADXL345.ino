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
               "time_us,a1_x_mps2,a1_y_mps2,a1_z_mps2,a2_x_mps2,a2_y_mps2,a2_z_mps2",
               "us,m/s^2,m/s^2,m/s^2,m/s^2,m/s^2,m/s^2",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  sensors_event_t e1, e2;
  accel1.getEvent(&e1);
  accel2.getEvent(&e2);

  stream.rowBegin(now);
  stream.field(e1.acceleration.x, 6); stream.field(e1.acceleration.y, 6); stream.field(e1.acceleration.z, 6);
  stream.field(e2.acceleration.x, 6); stream.field(e2.acceleration.y, 6); stream.field(e2.acceleration.z, 6);
  stream.rowEnd();
}
