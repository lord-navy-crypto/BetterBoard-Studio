#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Catastrophic Cancellation V2
// Compares two algebraically equivalent forms near x=0 and evaluates both
// against an independently stable series reference.
//
// f(x) = (1-cos x)/x^2
//      = 2*sin^2(x/2)/x^2
//      = 1/2 - x^2/24 + x^4/720 - x^6/40320 + x^8/3628800 - ...

const uint32_t BAUD = 115200;

float stableSeriesReference(float x) {
  const float x2 = x * x;
  const float x4 = x2 * x2;
  const float x6 = x4 * x2;
  const float x8 = x4 * x4;
  return 0.5f
       - x2 / 24.0f
       + x4 / 720.0f
       - x6 / 40320.0f
       + x8 / 3628800.0f;
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("NUMERIC_ERROR_CANCELLATION_V2");
  Serial.println("x,direct,reformulated,series_reference,abs_error_direct,abs_error_reformulated,form_delta");

  for (int exponent = 0; exponent <= 8; ++exponent) {
    const float x = powf(10.0f, -(float)exponent);
    const float direct = (1.0f - cosf(x)) / (x * x);
    const float s = sinf(0.5f * x);
    const float reformulated = 2.0f * s * s / (x * x);
    const float ref = stableSeriesReference(x);

    Serial.print(x, 10); Serial.print(',');
    Serial.print(direct, 10); Serial.print(',');
    Serial.print(reformulated, 10); Serial.print(',');
    Serial.print(ref, 10); Serial.print(',');
    Serial.print(fabsf(direct - ref), 10); Serial.print(',');
    Serial.print(fabsf(reformulated - ref), 10); Serial.print(',');
    Serial.println(fabsf(direct - reformulated), 10);
  }

  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
