#include <Wire.h>
#include <Adafruit_BME280.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000UL
#endif
#ifndef BB_BASELINE_SAMPLES
#define BB_BASELINE_SAMPLES 20
#endif

Adafruit_BME280 bme;
static unsigned long lastSample = 0;
static uint16_t baselineCount = 0;
static double pressureSumPa = 0.0;
static float baselinePressurePa = 101325.0f;
static bool baselineReady = false;

void setup() {
  Serial.begin(115200);
  if (!bme.begin(0x76) && !bme.begin(0x77)) while (true) delay(100);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - lastSample) < BB_SAMPLE_INTERVAL_US) return;
  lastSample = now;

  const float pressurePa = bme.readPressure();
  const float tempC = bme.readTemperature();

  if (!baselineReady) {
    pressureSumPa += pressurePa;
    baselineCount++;
    if (baselineCount >= BB_BASELINE_SAMPLES) {
      baselinePressurePa = pressureSumPa / baselineCount;
      baselineReady = true;
    }
  }

  const float ratio = pressurePa > 0.0f ? pressurePa / baselinePressurePa : 1.0f;
  const float relativeAltitudeM = 44330.0f * (1.0f - powf(ratio, 0.19029495f));

  Serial.print(now); Serial.print(',');
  Serial.print(pressurePa / 100.0f, 4); Serial.print(',');
  Serial.print(tempC, 4); Serial.print(',');
  Serial.print(baselinePressurePa / 100.0f, 4); Serial.print(',');
  Serial.print(relativeAltitudeM, 5); Serial.print(',');
  Serial.println(baselineReady ? 1 : 0);
}
