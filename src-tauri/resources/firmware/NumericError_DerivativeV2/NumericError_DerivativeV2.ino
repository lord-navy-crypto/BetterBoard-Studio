#include <Arduino.h>
#include <math.h>
#include <float.h>

// BetterBoard Numeric Error Depth — Derivative V2
// Sweeps h for forward and central differences at x=1.0 on AVR float32.
// The MCU library derivative is provenance only; host analysis should provide
// the independent high-precision reference and identify the truncation/roundoff minimum.

const uint32_t BAUD = 115200;
const float X = 1.0f;

void setup() {
  Serial.begin(BAUD);
  delay(300);
  Serial.println("exponent,h,forward,central,mcu_cos_reference,forward_vs_mcu_abs,central_vs_mcu_abs,float_bytes,double_bytes,float_epsilon,forward_us,central_us");
  for (int exponent = 0; exponent <= 8; ++exponent) {
    const float h = powf(10.0f, -(float)exponent);
    uint32_t started = micros();
    const float forward = (sinf(X + h) - sinf(X)) / h;
    const uint32_t forwardUs = micros() - started;
    started = micros();
    const float central = (sinf(X + h) - sinf(X - h)) / (2.0f * h);
    const uint32_t centralUs = micros() - started;
    const float mcuRef = cosf(X);
    Serial.print(exponent); Serial.print(','); Serial.print(h, 10); Serial.print(',');
    Serial.print(forward, 10); Serial.print(','); Serial.print(central, 10); Serial.print(',');
    Serial.print(mcuRef, 10); Serial.print(','); Serial.print(fabsf(forward - mcuRef), 10); Serial.print(',');
    Serial.print(fabsf(central - mcuRef), 10); Serial.print(','); Serial.print(sizeof(float)); Serial.print(',');
    Serial.print(sizeof(double)); Serial.print(','); Serial.print(FLT_EPSILON, 10); Serial.print(',');
    Serial.print(forwardUs); Serial.print(','); Serial.println(centralUs);
  }
}

void loop() { delay(1000); }
