#include <Arduino.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 5000UL
#endif

static unsigned long lastSample = 0;

static int readAverage(uint8_t count) {
  long sum = 0;
  for (uint8_t i = 0; i < count; ++i) sum += analogRead(A0);
  return (int)((sum + count / 2) / count);
}

void setup() {
  Serial.begin(115200);
  pinMode(A0, INPUT);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  lastSample = now;

  const int raw = analogRead(A0);
  const int avg4 = readAverage(4);
  const int avg16 = readAverage(16);
  const int d4 = avg4 - raw;
  const int d16 = avg16 - raw;

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(avg4); Serial.print(',');
  Serial.print(avg16); Serial.print(',');
  Serial.print(d4); Serial.print(',');
  Serial.println(d16);
}
