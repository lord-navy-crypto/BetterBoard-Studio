#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000UL
#endif

Adafruit_BME280 bme;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(300);
    digitalWrite(LED_BUILTIN, LOW); delay(300);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  bool ready = bme.begin(0x76, &Wire);
  if (!ready) ready = bme.begin(0x77, &Wire);
  if (!ready) failSensor();
  sampler.arm(micros());
  stream.begin("el-numerical-bme280-context",
               betterboard::experiments::target::NUMERICAL_ERROR_ANALYSIS,
               "time_us,temperature_c,pressure_hpa,humidity_pct",
               "us,degC,hPa,%",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const float temperature_c = bme.readTemperature();
  const float pressure_hpa = bme.readPressure() / 100.0f;
  const float humidity_pct = bme.readHumidity();

  stream.rowBegin(now);
  stream.field(temperature_c, 4); stream.field(pressure_hpa, 4); stream.field(humidity_pct, 4);
  stream.rowEnd();
}
