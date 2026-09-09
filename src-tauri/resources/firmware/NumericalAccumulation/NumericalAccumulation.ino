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
void setup() {
  Serial.begin(115200);
  delay(2000);
  const unsigned long n = (unsigned long)BB_SUM_COUNT;
  const float increment = (float)BB_INCREMENT;
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
void loop() {}
