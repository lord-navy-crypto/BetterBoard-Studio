#include <Arduino.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 2000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif

static unsigned long lastSample = 0;
static uint16_t n = 0;
static double sum = 0.0;
static double sumSq = 0.0;
static int minCode = 32767;
static int maxCode = -32768;

void setup() {
  Serial.begin(115200);
  pinMode(A0, INPUT);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  lastSample = now;

  const int code = analogRead(A0);
  sum += code;
  sumSq += (double)code * (double)code;
  if (code < minCode) minCode = code;
  if (code > maxCode) maxCode = code;
  n++;

  if (n >= BB_WINDOW_SAMPLES) {
    const double mean = sum / n;
    double variance = sumSq / n - mean * mean;
    if (variance < 0.0) variance = 0.0;
    const double stddev = sqrt(variance);
    Serial.print(now); Serial.print(',');
    Serial.print(mean, 4); Serial.print(',');
    Serial.print(stddev, 4); Serial.print(',');
    Serial.print(minCode); Serial.print(',');
    Serial.print(maxCode); Serial.print(',');
    Serial.println(maxCode - minCode);
    n = 0; sum = 0.0; sumSq = 0.0; minCode = 32767; maxCode = -32768;
  }
}
