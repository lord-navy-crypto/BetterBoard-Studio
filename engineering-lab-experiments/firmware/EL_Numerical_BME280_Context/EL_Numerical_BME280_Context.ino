#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000UL
#endif

Adafruit_BME280 bme;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);
unsigned long previous_sample_us = 0;

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
  const char* configuration = "schema=v2;sensor=BME280;address=0x76";
  bool ready = bme.begin(0x76, &Wire);
  if (!ready) {
    ready = bme.begin(0x77, &Wire);
    configuration = "schema=v2;sensor=BME280;address=0x77";
  }
  if (!ready) failSensor();
  sampler.arm(micros());
  stream.begin("el-numerical-bme280-context",
               betterboard::experiments::target::NUMERICAL_ERROR_ANALYSIS,
               "time_us,temperature_c,pressure_hpa,humidity_pct,sample_dt_us,read_duration_us,quality_flags",
               "us,degC,hPa,%,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               configuration);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const unsigned long sample_dt_us = previous_sample_us == 0 ? 0 : now - previous_sample_us;
  previous_sample_us = now;
  uint16_t quality = betterboard::experiments::evidence::Valid;
  if (sample_dt_us != 0 && sample_dt_us > BB_SAMPLE_INTERVAL_US + BB_SAMPLE_INTERVAL_US / 2) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::TimingLate);
  }

  const unsigned long read_start_us = micros();
  const float temperature_c = bme.readTemperature();
  const float pressure_hpa = bme.readPressure() / 100.0f;
  const float humidity_pct = bme.readHumidity();
  const unsigned long read_duration_us = micros() - read_start_us;
  const bool valid = isfinite(temperature_c) && isfinite(pressure_hpa) && isfinite(humidity_pct);
  if (!valid) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::SensorError);
  }

  stream.rowBegin(now);
  if (valid) {
    stream.field(temperature_c, 4); stream.field(pressure_hpa, 4); stream.field(humidity_pct, 4);
  } else {
    stream.field(""); stream.field(""); stream.field("");
  }
  stream.field(sample_dt_us); stream.field(read_duration_us);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
