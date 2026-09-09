#include <Arduino.h>
#include <math.h>

const uint32_t BAUD = 115200;
const float PI_F = 3.14159265358979323846f;

float f(float x) { return sinf(x); }

float leftRectangle(uint16_t n) {
  const float h = PI_F / (float)n;
  float sum = 0.0f;
  for (uint16_t i = 0; i < n; ++i) sum += f(i * h);
  return sum * h;
}

float trapezoid(uint16_t n) {
  const float h = PI_F / (float)n;
  float sum = 0.5f * (f(0.0f) + f(PI_F));
  for (uint16_t i = 1; i < n; ++i) sum += f(i * h);
  return sum * h;
}

float simpson(uint16_t n) {
  if (n % 2 != 0) ++n;
  const float h = PI_F / (float)n;
  float sum = f(0.0f) + f(PI_F);
  for (uint16_t i = 1; i < n; ++i) sum += (i % 2 ? 4.0f : 2.0f) * f(i * h);
  return sum * h / 3.0f;
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  const float reference = 2.0f;
  const uint16_t ns[] = {4, 8, 16, 32, 64, 128, 256};
  Serial.println("n,left,trapezoid,simpson,reference,error_left,error_trapezoid,error_simpson");
  for (uint8_t k = 0; k < sizeof(ns) / sizeof(ns[0]); ++k) {
    const uint16_t n = ns[k];
    const float a = leftRectangle(n);
    const float b = trapezoid(n);
    const float c = simpson(n);
    Serial.print(n); Serial.print(',');
    Serial.print(a, 9); Serial.print(',');
    Serial.print(b, 9); Serial.print(',');
    Serial.print(c, 9); Serial.print(',');
    Serial.print(reference, 9); Serial.print(',');
    Serial.print(fabsf(a - reference), 9); Serial.print(',');
    Serial.print(fabsf(b - reference), 9); Serial.print(',');
    Serial.println(fabsf(c - reference), 9);
  }
}

void loop() { delay(1000); }
