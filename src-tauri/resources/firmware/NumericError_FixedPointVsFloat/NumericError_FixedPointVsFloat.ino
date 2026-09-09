#include <Arduino.h>
#include <math.h>

const uint32_t BAUD = 115200;
const int32_t Q = 32768L;

int16_t toQ15(float x) {
  if (x > 0.999969f) x = 0.999969f;
  if (x < -1.0f) x = -1.0f;
  return (int16_t)lroundf(x * (float)Q);
}

float fromQ15(int16_t x) { return (float)x / (float)Q; }

int16_t q15Mul(int16_t a, int16_t b) {
  const int32_t prod = (int32_t)a * (int32_t)b;
  int32_t scaled;
  if (prod >= 0) scaled = (prod + (1L << 14)) / Q;
  else scaled = -(((-prod) + (1L << 14)) / Q);
  if (scaled > 32767) scaled = 32767;
  if (scaled < -32768) scaled = -32768;
  return (int16_t)scaled;
}

void runCase(uint8_t caseId, float input) {
  const float a = 0.93f;
  const float b = 0.07f;
  float yf = 0.0f;
  int16_t yq = 0;
  const int16_t aq = toQ15(a);
  const int16_t bq = toQ15(b);
  const int16_t uq = toQ15(input);

  for (uint16_t n = 0; n < 300; ++n) {
    yf = a * yf + b * input;
    int32_t acc = (int32_t)q15Mul(aq, yq) + (int32_t)q15Mul(bq, uq);
    bool saturated = false;
    if (acc > 32767) { acc = 32767; saturated = true; }
    if (acc < -32768) { acc = -32768; saturated = true; }
    yq = (int16_t)acc;
    const float yqf = fromQ15(yq);

    Serial.print(caseId); Serial.print(',');
    Serial.print(input, 6); Serial.print(',');
    Serial.print(n); Serial.print(',');
    Serial.print(yf, 9); Serial.print(',');
    Serial.print(yq); Serial.print(',');
    Serial.print(yqf, 9); Serial.print(',');
    Serial.print(fabsf(yf - yqf), 9); Serial.print(',');
    Serial.println(saturated ? 1 : 0);
  }
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("NUMERIC_ERROR_FIXED_POINT_V2");
  Serial.println("case_id,input,step,float_y,q15_raw,q15_y,abs_diff,saturated");
  runCase(0, 0.8f);
  runCase(1, -0.8f);
  runCase(2, 0.12345f);
  runCase(3, -0.12345f);
  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
