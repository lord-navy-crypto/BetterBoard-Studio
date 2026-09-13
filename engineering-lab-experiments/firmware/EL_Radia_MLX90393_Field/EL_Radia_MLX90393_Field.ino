#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif

Adafruit_MLX90393 mag;
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
  if (!mag.begin_I2C()) failSensor();
  sampler.reset(micros());
  stream.begin("el-radia-mlx90393-field",
               betterboard::experiments::target::RADIA_MAGNET_STUDIO,
               "time_us,bx_uT,by_uT,bz_uT,bmag_uT,bxy_uT,azimuth_rad,elevation_rad,sample_dt_us,read_duration_us,quality_flags",
               "us,uT,uT,uT,uT,uT,rad,rad,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;frame=sensor;mlx90393_transport=i2c;derived=bxy|azimuth|elevation");
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
  float x, y, z;
  const bool ok = mag.readData(&x, &y, &z);
  const unsigned long read_duration_us = micros() - read_start_us;

  stream.rowBegin(now);
  if (!ok) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::SensorError);
    stream.field(""); stream.field(""); stream.field(""); stream.field("");
    stream.field(""); stream.field(""); stream.field("");
  } else {
    const float bxy = sqrtf(x * x + y * y);
    const float bmag = sqrtf(bxy * bxy + z * z);
    const float azimuth = atan2f(y, x);
    const float elevation = atan2f(z, bxy);
    stream.field(x, 4); stream.field(y, 4); stream.field(z, 4); stream.field(bmag, 4);
    stream.field(bxy, 4); stream.field(azimuth, 7); stream.field(elevation, 7);
  }
  stream.field(sample_dt_us);
  stream.field(read_duration_us);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
