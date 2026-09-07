#include <Wire.h>
#include <Adafruit_MLX90393.h>

Adafruit_MLX90393 mag;

const unsigned long SAMPLE_INTERVAL_US = 50000UL; // 20 Hz

// 0 = Bx, 1 = By, 2 = Bz
const uint8_t PRIMARY_AXIS = 2;

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

  const float primary = primaryField(bx, by, bz);

  // time_us,Bx_uT,By_uT,Bz_uT,primary_uT
  Serial.print(now);
  Serial.print(',');
  Serial.print(bx, 4);
  Serial.print(',');
  Serial.print(by, 4);
  Serial.print(',');
  Serial.print(bz, 4);
  Serial.print(',');
  Serial.println(primary, 4);
}
