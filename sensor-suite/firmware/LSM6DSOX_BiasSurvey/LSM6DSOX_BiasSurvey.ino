#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <BetterBoard.h>

#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

Adafruit_LSM6DSOX imu;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::OnlineStatistics ax_stats;
betterboard::math::OnlineStatistics ay_stats;
betterboard::math::OnlineStatistics az_stats;
betterboard::math::OnlineStatistics gx_stats;
betterboard::math::OnlineStatistics gy_stats;
betterboard::math::OnlineStatistics gz_stats;

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(120);
    digitalWrite(LED_BUILTIN, LOW); delay(120);
  }
}

void resetWindow() {
  ax_stats.reset(); ay_stats.reset(); az_stats.reset();
  gx_stats.reset(); gy_stats.reset(); gz_stats.reset();
}

void setup() {
  Serial.begin(115200);
  if (!imu.begin_I2C()) failSensor();
  sampler.reset(micros());
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  sensors_event_t a, g, t;
  imu.getEvent(&a, &g, &t);
  ax_stats.push(a.acceleration.x); ay_stats.push(a.acceleration.y); az_stats.push(a.acceleration.z);
  gx_stats.push(g.gyro.x); gy_stats.push(g.gyro.y); gz_stats.push(g.gyro.z);

  if (ax_stats.count() < BB_WINDOW_SAMPLES) return;

  Serial.print(now); Serial.print(',');
  Serial.print(ax_stats.mean(), 6); Serial.print(',');
  Serial.print(ay_stats.mean(), 6); Serial.print(',');
  Serial.print(az_stats.mean(), 6); Serial.print(',');
  Serial.print(gx_stats.mean(), 7); Serial.print(',');
  Serial.print(gy_stats.mean(), 7); Serial.print(',');
  Serial.print(gz_stats.mean(), 7); Serial.print(',');
  Serial.print(gx_stats.standardDeviationPopulation(), 7); Serial.print(',');
  Serial.print(gy_stats.standardDeviationPopulation(), 7); Serial.print(',');
  Serial.println(gz_stats.standardDeviationPopulation(), 7);

  resetWindow();
}
