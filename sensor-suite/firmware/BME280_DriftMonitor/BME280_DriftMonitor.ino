#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000UL
#endif

Adafruit_BME280 bme;
unsigned long last_sample_us = 0;
bool have_baseline = false;
float t0 = 0.0f, p0 = 0.0f, h0 = 0.0f;

void setup() {
  Serial.begin(115200);
  if (!bme.begin(0x76) && !bme.begin(0x77)) while (true) delay(1000);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  const float t = bme.readTemperature();
  const float p = bme.readPressure() / 100.0f;
  const float h = bme.readHumidity();
  if (!have_baseline) { t0 = t; p0 = p; h0 = h; have_baseline = true; }
  Serial.print(now); Serial.print(',');
  Serial.print(t, 5); Serial.print(',');
  Serial.print(p, 5); Serial.print(',');
  Serial.print(h, 5); Serial.print(',');
  Serial.print(t - t0, 5); Serial.print(',');
  Serial.print(p - p0, 5); Serial.print(',');
  Serial.println(h - h0, 5);
}
