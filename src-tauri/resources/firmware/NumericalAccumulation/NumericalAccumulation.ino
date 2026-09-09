#ifndef BB_SUM_COUNT
#define BB_SUM_COUNT 20000
#endif
#ifndef BB_INCREMENT
#define BB_INCREMENT 0.001
#endif

float naiveSum(unsigned long n, float increment) {
  float sum = 0.0f;
  for (unsigned long i = 0; i < n; ++i) sum += increment;
  return sum;
}

float kahanSum(unsigned long n, float increment) {
  float sum = 0.0f;
  float c = 0.0f;
  for (unsigned long i = 0; i < n; ++i) {
    const float y = increment - c;
    const float t = sum + y;
    c = (t - sum) - y;
    sum = t;
  }
  return sum;
}

void emitCheckpoint(unsigned long n, float increment) {
  const unsigned long t0 = micros();
  const float naive = naiveSum(n, increment);
  const unsigned long t1 = micros();
  const float kahan = kahanSum(n, increment);
  const unsigned long t2 = micros();
  const float mathematical_target = (float)n * increment;

  Serial.print(n); Serial.print(',');
  Serial.print(increment, 10); Serial.print(',');
  Serial.print(naive, 10); Serial.print(',');
  Serial.print(kahan, 10); Serial.print(',');
  Serial.print(mathematical_target, 10); Serial.print(',');
  Serial.print(naive - mathematical_target, 10); Serial.print(',');
  Serial.print(kahan - mathematical_target, 10); Serial.print(',');
  Serial.print((unsigned long)(t1 - t0)); Serial.print(',');
  Serial.println((unsigned long)(t2 - t1));
}

void setup() {
  Serial.begin(115200);
  delay(2000);
  const unsigned long requested = (unsigned long)BB_SUM_COUNT;
  const float increment = (float)BB_INCREMENT;

  // One run now produces an error-growth curve instead of hiding the behavior
  // behind a single endpoint. The existing 9-column schema is unchanged.
  const unsigned long checkpoints[] = {
    100UL,200UL,500UL,1000UL,2000UL,5000UL,10000UL,20000UL,50000UL
  };
  const size_t n = sizeof(checkpoints) / sizeof(checkpoints[0]);
  bool emitted_requested = false;
  for (size_t i = 0; i < n; ++i) {
    if (checkpoints[i] > requested) break;
    emitCheckpoint(checkpoints[i], increment);
    if (checkpoints[i] == requested) emitted_requested = true;
  }
  if (!emitted_requested) emitCheckpoint(requested, increment);
}

void loop() {}
