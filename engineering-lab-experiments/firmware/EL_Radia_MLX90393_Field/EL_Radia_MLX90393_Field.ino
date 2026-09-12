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
               "time_us,bx_uT,by_uT,bz_uT,bmag_uT",
               "us,uT,uT,uT,uT",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  float x, y, z;
  if (!mag.readData(&x, &y, &z)) return;
  const float bmag = sqrtf(x * x + y * y + z * z);

  stream.rowBegin(now);
  stream.field(x, 4); stream.field(y, 4); stream.field(z, 4); stream.field(bmag, 4);
  stream.rowEnd();
}
