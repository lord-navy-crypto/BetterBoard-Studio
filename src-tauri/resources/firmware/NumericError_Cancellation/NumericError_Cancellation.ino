#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Cancellation
// Compares two algebraically equivalent expressions near x=0.
// f1 = (1 - cos(x)) / x^2
// f2 = 2*sin(x/2)^2 / x^2
// True limit is 0.5; the second form is numerically better conditioned near zero.

const uint32_t BAUD = 115200;

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("x,direct,reformulated,limit_ref,abs_error_direct,abs_error_reformulated");
  for (int exponent = 0; exponent <= 8; ++exponent) {
    const float x = powf(10.0f, -(float)exponent);
    const float direct = (1.0f - cosf(x)) / (x * x);
    const float s = sinf(0.5f * x);
    const float reformulated = 2.0f * s * s / (x * x);
    const float ref = 0.5f;
    Serial.print(x, 10); Serial.print(',');
    Serial.print(direct, 10); Serial.print(',');
    Serial.print(reformulated, 10); Serial.print(',');
    Serial.print(ref, 10); Serial.print(',');
    Serial.print(fabsf(direct-ref), 10); Serial.print(',');
    Serial.println(fabsf(reformulated-ref), 10);
  }
  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
