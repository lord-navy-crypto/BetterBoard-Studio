#include <Arduino.h>
#include <float.h>

// BetterBoard Numeric Error Depth — Summation V3
// Consolidates legacy Summation V1/V2. The increment is encoded exactly as a
// rational pair for host oracle construction. Compares naive and Kahan summation
// and records timing plus AVR type-size provenance.

const uint32_t BAUD = 115200;
const uint32_t INC_NUM = 1UL;
const uint32_t INC_DEN = 10000UL;

float naiveSum(uint32_t n, float increment) {
  float total = 0.0f;
  for (uint32_t i = 0; i < n; ++i) total += increment;
  return total;
}
float kahanSum(uint32_t n, float increment) {
  float total = 0.0f, c = 0.0f;
  for (uint32_t i = 0; i < n; ++i) {
    const float y = increment - c;
    const float t = total + y;
    c = (t - total) - y;
    total = t;
  }
  return total;
}

void setup() {
  Serial.begin(BAUD); delay(300);
  const uint32_t counts[] = {10UL,100UL,1000UL,10000UL,50000UL,100000UL};
  const float increment = (float)INC_NUM/(float)INC_DEN;
  Serial.println("n,increment_num,increment_den,increment_float,naive,kahan,naive_us,kahan_us,float_bytes,double_bytes,float_epsilon");
  for (uint8_t i=0; i<sizeof(counts)/sizeof(counts[0]); ++i) {
    const uint32_t n=counts[i];
    uint32_t t=micros(); const float naive=naiveSum(n,increment); const uint32_t naiveUs=micros()-t;
    t=micros(); const float kahan=kahanSum(n,increment); const uint32_t kahanUs=micros()-t;
    Serial.print(n); Serial.print(','); Serial.print(INC_NUM); Serial.print(','); Serial.print(INC_DEN); Serial.print(',');
    Serial.print(increment,10); Serial.print(','); Serial.print(naive,10); Serial.print(','); Serial.print(kahan,10); Serial.print(',');
    Serial.print(naiveUs); Serial.print(','); Serial.print(kahanUs); Serial.print(',');
    Serial.print(sizeof(float)); Serial.print(','); Serial.print(sizeof(double)); Serial.print(','); Serial.println(FLT_EPSILON,10);
  }
}
void loop(){ delay(1000); }
