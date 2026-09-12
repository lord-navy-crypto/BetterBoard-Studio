#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 20
#endif

Adafruit_MLX90393 mag;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::OnlineStatistics x_stats;
betterboard::math::OnlineStatistics y_stats;
betterboard::math::OnlineStatistics z_stats;

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(120);
    digitalWrite(LED_BUILTIN, LOW); delay(120);
  }
}

void resetWindow() {
  x_stats.reset(); y_stats.reset(); z_stats.reset();
}

void setup() {
  Serial.begin(115200);
  if (!mag.begin_I2C()) failSensor();
  sampler.reset(micros());
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  float x, y, z;
  if (!mag.readData(&x, &y, &z)) return;
  x_stats.push(x); y_stats.push(y); z_stats.push(z);

  if (x_stats.count() < BB_WINDOW_SAMPLES) return;

  const double mx = x_stats.mean();
  const double my = y_stats.mean();
  const double mz = z_stats.mean();
  const double magnitude = sqrt(mx * mx + my * my + mz * mz);

  Serial.print(now); Serial.print(',');
  Serial.print(mx, 4); Serial.print(',');
  Serial.print(my, 4); Serial.print(',');
  Serial.print(mz, 4); Serial.print(',');
  Serial.print(magnitude, 4); Serial.print(',');
  Serial.print(x_stats.standardDeviationPopulation(), 4); Serial.print(',');
  Serial.print(y_stats.standardDeviationPopulation(), 4); Serial.print(',');
  Serial.println(z_stats.standardDeviationPopulation(), 4);

  resetWindow();
}
