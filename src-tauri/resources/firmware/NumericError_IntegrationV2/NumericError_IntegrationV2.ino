#include <Arduino.h>
#include <math.h>
#include <float.h>

// BetterBoard Numeric Error Depth — Integration V2
// Integrates sin(x) over [0, pi] with left, trapezoid and Simpson rules.
// Emits runtime and method values; host-side analysis owns the independent oracle
// and observed-order calculation.

const uint32_t BAUD = 115200;
const float PI_F = 3.14159265358979323846f;
float f(float x) { return sinf(x); }

float leftRectangle(uint16_t n) {
  const float h = PI_F / (float)n; float sum = 0.0f;
  for (uint16_t i = 0; i < n; ++i) sum += f((float)i * h);
  return sum * h;
}
float trapezoid(uint16_t n) {
  const float h = PI_F / (float)n; float sum = 0.5f * (f(0.0f) + f(PI_F));
  for (uint16_t i = 1; i < n; ++i) sum += f((float)i * h);
  return sum * h;
}
float simpson(uint16_t n) {
  if (n & 1U) ++n;
  const float h = PI_F / (float)n; float sum = f(0.0f) + f(PI_F);
  for (uint16_t i = 1; i < n; ++i) sum += (i & 1U ? 4.0f : 2.0f) * f((float)i * h);
  return sum * h / 3.0f;
}

void setup() {
  Serial.begin(BAUD); delay(300);
  const uint16_t ns[] = {4, 8, 16, 32, 64, 128, 256, 512};
  Serial.println("n,h,left,trapezoid,simpson,mcu_analytic_reference,left_vs_mcu_abs,trapezoid_vs_mcu_abs,simpson_vs_mcu_abs,left_us,trapezoid_us,simpson_us,float_bytes,double_bytes,float_epsilon");
  for (uint8_t k = 0; k < sizeof(ns)/sizeof(ns[0]); ++k) {
    const uint16_t n = ns[k]; const float h = PI_F/(float)n;
    uint32_t t = micros(); const float left = leftRectangle(n); const uint32_t leftUs = micros()-t;
    t = micros(); const float trap = trapezoid(n); const uint32_t trapUs = micros()-t;
    t = micros(); const float simp = simpson(n); const uint32_t simpUs = micros()-t;
    const float mcuRef = 2.0f;
    Serial.print(n); Serial.print(','); Serial.print(h, 10); Serial.print(',');
    Serial.print(left, 10); Serial.print(','); Serial.print(trap, 10); Serial.print(','); Serial.print(simp, 10); Serial.print(',');
    Serial.print(mcuRef, 10); Serial.print(','); Serial.print(fabsf(left-mcuRef),10); Serial.print(',');
    Serial.print(fabsf(trap-mcuRef),10); Serial.print(','); Serial.print(fabsf(simp-mcuRef),10); Serial.print(',');
    Serial.print(leftUs); Serial.print(','); Serial.print(trapUs); Serial.print(','); Serial.print(simpUs); Serial.print(',');
    Serial.print(sizeof(float)); Serial.print(','); Serial.print(sizeof(double)); Serial.print(','); Serial.println(FLT_EPSILON, 10);
  }
}
void loop() { delay(1000); }
