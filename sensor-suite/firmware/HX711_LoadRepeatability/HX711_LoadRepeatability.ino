#include <Arduino.h>
#include <HX711.h>
#include <math.h>

#ifndef BB_HX711_DOUT
#define BB_HX711_DOUT 4
#endif
#ifndef BB_HX711_SCK
#define BB_HX711_SCK 5
#endif
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0L
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0f
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 20
#endif

HX711 scale;
static uint16_t n = 0;
static double sum = 0.0;
static double sumSq = 0.0;

void setup() {
  Serial.begin(115200);
  scale.begin(BB_HX711_DOUT, BB_HX711_SCK);
}

void loop() {
  if (!scale.is_ready()) return;
  const long raw = scale.read();
  const float forceN = ((float)(raw - BB_OFFSET_COUNTS)) / BB_COUNTS_PER_NEWTON;
  sum += forceN;
  sumSq += (double)forceN * (double)forceN;
  n++;

  if (n >= BB_WINDOW_SAMPLES) {
    const double mean = sum / n;
    double variance = sumSq / n - mean * mean;
    if (variance < 0.0) variance = 0.0;
    const double stddev = sqrt(variance);
    Serial.print(millis()); Serial.print(',');
    Serial.print(mean, 6); Serial.print(',');
    Serial.print(stddev, 6); Serial.print(',');
    Serial.println(n);
    n = 0; sum = 0.0; sumSq = 0.0;
  }
}
