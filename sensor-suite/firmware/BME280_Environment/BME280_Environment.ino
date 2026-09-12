#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000
#endif

Adafruit_BME280 bme;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(300);
    digitalWrite(LED_BUILTIN, LOW);
    delay(300);
  }
}
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  bool ready = bme.begin(0x76, &Wire);
  if (!ready) ready = bme.begin(0x77, &Wire);
  if (!ready) sensorFail();
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  const float temperature_c = bme.readTemperature();
  const float pressure_hpa = bme.readPressure() / 100.0f;
  const float humidity_pct = bme.readHumidity();

  // time_us,temperature_c,pressure_hpa,humidity_pct
  Serial.print(now);
  Serial.print(','); Serial.print(temperature_c, 4);
  Serial.print(','); Serial.print(pressure_hpa, 4);
  Serial.print(','); Serial.println(humidity_pct, 4);
}
