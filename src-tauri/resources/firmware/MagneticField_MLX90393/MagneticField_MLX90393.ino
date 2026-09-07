#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <math.h>

// BetterBoard Magnet Bench 01 — Vector Field Acquisition
//
// The sensor reports the lab-frame magnetic-field vector. BetterBoard keeps
// all three axes plus the vector magnitude and one primary axis. Ambient field,
// fixture offsets, sensor orientation, distance, and calibration remain explicit
// experimental variables; the firmware does not silently subtract a baseline.
//
// Schema:
// time_us,Bx_uT,By_uT,Bz_uT,Bmag_uT,primary_uT

Adafruit_MLX90393 mag;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = 50000UL;  // 20 Hz
constexpr uint8_t PRIMARY_AXIS = 2;                    // 0=Bx, 1=By, 2=Bz
unsigned long last_sample_us = 0;

float primaryField(float bx, float by, float bz) {
  if (PRIMARY_AXIS == 0) return bx;
  if (PRIMARY_AXIS == 1) return by;
  return bz;
}

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(150);
    digitalWrite(LED_BUILTIN, LOW);
    delay(150);
  }
}
}  // namespace

void setup() {
  Serial.begin(115200);
  if (!mag.begin_I2C()) {
    sensorFail();
  }
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  float bx, by, bz;
  if (!mag.readData(&bx, &by, &bz)) return;

  const float bmag = sqrtf(bx * bx + by * by + bz * bz);
  const float primary = primaryField(bx, by, bz);

  Serial.print(now);
  Serial.print(',');
  Serial.print(bx, 4);
  Serial.print(',');
  Serial.print(by, 4);
  Serial.print(',');
  Serial.print(bz, 4);
  Serial.print(',');
  Serial.print(bmag, 4);
  Serial.print(',');
  Serial.println(primary, 4);
}
