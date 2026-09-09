#include <math.h>
#ifndef BB_X_VALUE
#define BB_X_VALUE 1.0
#endif

float forwardDiff(float x, float h) { return (sinf(x + h) - sinf(x)) / h; }
float centralDiff(float x, float h) { return (sinf(x + h) - sinf(x - h)) / (2.0f * h); }

void setup() {
  Serial.begin(115200);
  delay(2000);
  const float x = (float)BB_X_VALUE;
  const float ref = cosf(x);
  const float hs[] = {1e-1f,5e-2f,2e-2f,1e-2f,5e-3f,2e-3f,1e-3f,5e-4f,2e-4f,1e-4f,5e-5f,2e-5f,1e-5f,5e-6f,2e-6f,1e-6f,5e-7f,2e-7f,1e-7f};
  const size_t n = sizeof(hs) / sizeof(hs[0]);
  for (size_t i = 0; i < n; ++i) {
    const float h = hs[i];
    const float fwd = forwardDiff(x, h);
    const float ctr = centralDiff(x, h);
    Serial.print(h, 10); Serial.print(',');
    Serial.print(fwd, 10); Serial.print(',');
    Serial.print(ctr, 10); Serial.print(',');
    Serial.print(ref, 10); Serial.print(',');
    Serial.print(fabsf(fwd - ref), 10); Serial.print(',');
    Serial.println(fabsf(ctr - ref), 10);
  }
}
void loop() {}
