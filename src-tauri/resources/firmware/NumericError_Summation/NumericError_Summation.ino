#include <Arduino.h>
#include <math.h>

const uint32_t BAUD = 115200;

float naiveSum(uint32_t n, float increment) {
  float total = 0.0f;
  for (uint32_t i = 0; i < n; ++i) total += increment;
  return total;
}

float kahanSum(uint32_t n, float increment) {
  float total = 0.0f;
  float c = 0.0f;
  for (uint32_t i = 0; i < n; ++i) {
    const float y = increment - c;
    const float t = total + y;
    c = (t - total) - y;
    total = t;
  }
  return total;
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  const uint32_t counts[] = {10UL, 100UL, 1000UL, 10000UL, 50000UL, 100000UL};
  const float increment = 0.0001f;
  Serial.println("n,increment,reference,naive,kahan,abs_error_naive,abs_error_kahan");
  for (uint8_t i = 0; i < sizeof(counts) / sizeof(counts[0]); ++i) {
    const uint32_t n = counts[i];
    const float reference = (float)n * increment;
    const float naive = naiveSum(n, increment);
    const float kahan = kahanSum(n, increment);
    Serial.print(n); Serial.print(',');
    Serial.print(increment, 8); Serial.print(',');
    Serial.print(reference, 8); Serial.print(',');
    Serial.print(naive, 8); Serial.print(',');
    Serial.print(kahan, 8); Serial.print(',');
    Serial.print(fabsf(naive - reference), 10); Serial.print(',');
    Serial.println(fabsf(kahan - reference), 10);
  }
}

void loop() { delay(1000); }
