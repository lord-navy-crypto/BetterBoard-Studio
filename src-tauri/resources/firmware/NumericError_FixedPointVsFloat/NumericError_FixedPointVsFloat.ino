#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Fixed Point vs Float
// Compares a simple first-order recurrence using float and Q15 fixed point.

const uint32_t BAUD = 115200;
const int32_t Q = 32768L;

int16_t toQ15(float x) {
  if (x > 0.999969f) x = 0.999969f;
  if (x < -1.0f) x = -1.0f;
  return (int16_t)lroundf(x * (float)Q);
}

float fromQ15(int16_t x) { return (float)x / (float)Q; }

int16_t q15Mul(int16_t a, int16_t b) {
  int32_t prod = (int32_t)a * (int32_t)b;
  prod += (prod >= 0 ? (1L << 14) : -(1L << 14));
  prod >>= 15;
  if (prod > 32767) prod = 32767;
  if (prod < -32768) prod = -32768;
  return (int16_t)prod;
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("step,float_y,q15_raw,q15_y,abs_diff");

  const float a = 0.93f;
  const float b = 0.07f;
  float yf = 0.0f;
  int16_t yq = 0;
  const int16_t aq = toQ15(a);
  const int16_t bq = toQ15(b);
  const int16_t uq = toQ15(0.8f);

  for (uint16_t n = 0; n < 300; ++n) {
    yf = a * yf + b * 0.8f;
    int32_t acc = (int32_t)q15Mul(aq, yq) + (int32_t)q15Mul(bq, uq);
    if (acc > 32767) acc = 32767;
    if (acc < -32768) acc = -32768;
    yq = (int16_t)acc;
    const float yqf = fromQ15(yq);
    Serial.print(n); Serial.print(',');
    Serial.print(yf, 9); Serial.print(',');
    Serial.print(yq); Serial.print(',');
    Serial.print(yqf, 9); Serial.print(',');
    Serial.println(fabsf(yf - yqf), 9);
  }
  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
