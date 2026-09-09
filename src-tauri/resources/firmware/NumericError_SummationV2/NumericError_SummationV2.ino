#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Summation V2
// Encodes the increment exactly as numerator/denominator so the host can build
// an independent high-precision reference. Also records execution time.

const uint32_t BAUD = 115200;
const uint32_t INC_NUM = 1UL;
const uint32_t INC_DEN = 10000UL;

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
  const float increment = (float)INC_NUM / (float)INC_DEN;

  Serial.println("n,increment_num,increment_den,increment_float,naive,kahan,naive_us,kahan_us,float_bytes,double_bytes,float_epsilon");

  for (uint8_t i = 0; i < sizeof(counts) / sizeof(counts[0]); ++i) {
    const uint32_t n = counts[i];

    uint32_t started = micros();
    const float naive = naiveSum(n, increment);
    const uint32_t naiveUs = micros() - started;

    started = micros();
    const float kahan = kahanSum(n, increment);
    const uint32_t kahanUs = micros() - started;

    Serial.print(n); Serial.print(',');
    Serial.print(INC_NUM); Serial.print(',');
    Serial.print(INC_DEN); Serial.print(',');
    Serial.print(increment, 10); Serial.print(',');
    Serial.print(naive, 10); Serial.print(',');
    Serial.print(kahan, 10); Serial.print(',');
    Serial.print(naiveUs); Serial.print(',');
    Serial.print(kahanUs); Serial.print(',');
    Serial.print(sizeof(float)); Serial.print(',');
    Serial.print(sizeof(double)); Serial.print(',');
    Serial.println(FLT_EPSILON, 10);
  }
}

void loop() { delay(1000); }
