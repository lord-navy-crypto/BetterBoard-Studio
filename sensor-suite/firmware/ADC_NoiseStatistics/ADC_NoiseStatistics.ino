#include <Arduino.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 2000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::OnlineStatistics stats;

void setup() {
  Serial.begin(115200);
  pinMode(A0, INPUT);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  stats.push(static_cast<double>(analogRead(A0)));
  if (stats.count() < BB_WINDOW_SAMPLES) return;

  Serial.print(now); Serial.print(',');
  Serial.print(stats.mean(), 4); Serial.print(',');
  Serial.print(stats.standardDeviationPopulation(), 4); Serial.print(',');
  Serial.print(stats.minimum(), 0); Serial.print(',');
  Serial.print(stats.maximum(), 0); Serial.print(',');
  Serial.println(stats.peakToPeak(), 0);

  stats.reset();
}
