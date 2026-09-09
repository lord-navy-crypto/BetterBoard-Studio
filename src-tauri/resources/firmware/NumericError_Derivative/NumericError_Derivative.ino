#include <Arduino.h>
#include <math.h>

const uint32_t BAUD = 115200;
const float X = 1.0f;

void setup() {
  Serial.begin(BAUD);
  delay(500);
  const float reference = cosf(X);
  Serial.println("h,forward,central,reference,abs_error_forward,abs_error_central");
  for (int exponent = 0; exponent <= 8; ++exponent) {
    const float h = powf(10.0f, -(float)exponent);
    const float forward = (sinf(X + h) - sinf(X)) / h;
    const float central = (sinf(X + h) - sinf(X - h)) / (2.0f * h);
    Serial.print(h, 10); Serial.print(',');
    Serial.print(forward, 10); Serial.print(',');
    Serial.print(central, 10); Serial.print(',');
    Serial.print(reference, 10); Serial.print(',');
    Serial.print(fabsf(forward - reference), 10); Serial.print(',');
    Serial.println(fabsf(central - reference), 10);
  }
}

void loop() { delay(1000); }
