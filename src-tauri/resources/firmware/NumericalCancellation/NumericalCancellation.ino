#include <math.h>

void emitCase(float x) {
  const float root = sqrtf(1.0f + x);
  const float raw = root - 1.0f;
  const float stable = x / (root + 1.0f);
  const float diff = fabsf(raw - stable);
  const float rel = stable != 0.0f ? diff / fabsf(stable) : 0.0f;

  Serial.print(x, 10); Serial.print(',');
  Serial.print(raw, 10); Serial.print(',');
  Serial.print(stable, 10); Serial.print(',');
  Serial.print(diff, 10); Serial.print(',');
  Serial.print(rel, 10); Serial.print(',');
  Serial.println(raw == 0.0f ? 1 : 0);
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  // Probe cancellation from both sides of zero. The algebraically stable form
  // remains an MCU comparison method; independent host-oracle analysis decides
  // which result is actually closer to the mathematical value.
  const float magnitudes[] = {
    1e-1f,5e-2f,1e-2f,5e-3f,1e-3f,5e-4f,1e-4f,5e-5f,
    1e-5f,5e-6f,1e-6f,5e-7f,2e-7f,1e-7f,5e-8f,2e-8f,1e-8f
  };
  const size_t n = sizeof(magnitudes) / sizeof(magnitudes[0]);

  for (size_t i = 0; i < n; ++i) emitCase(-magnitudes[i]);
  for (size_t i = n; i > 0; --i) emitCase(magnitudes[i - 1]);
}

void loop() {}
