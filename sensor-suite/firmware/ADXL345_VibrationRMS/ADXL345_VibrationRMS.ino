#include <Wire.h>
#include <Adafruit_ADXL345_U.h>
#include <Adafruit_Sensor.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(34501);
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::RmsAccumulator rms;
betterboard::signal::PeakHold peak;

void setup() {
  Serial.begin(115200);
  if (!accel.begin()) while (true) delay(100);
  accel.setRange(ADXL345_RANGE_16_G);
  sampler.reset(micros());
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  sensors_event_t e;
  accel.getEvent(&e);
  const double mag = sqrt(
      static_cast<double>(e.acceleration.x) * e.acceleration.x +
      static_cast<double>(e.acceleration.y) * e.acceleration.y +
      static_cast<double>(e.acceleration.z) * e.acceleration.z);

  rms.push(mag);
  peak.push(mag);
  if (rms.count() < BB_WINDOW_SAMPLES) return;

  Serial.print(now); Serial.print(',');
  Serial.print(rms.rms(), 5); Serial.print(',');
  Serial.print(peak.peak(), 5); Serial.print(',');
  Serial.println(rms.count());

  rms.reset();
  peak.reset();
}
