#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000UL
#endif

struct EnvironmentSample {
  float temperature_c{0.0f};
  float pressure_hpa{0.0f};
  float humidity_pct{0.0f};
};

Adafruit_BME280 bme;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0U;

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
  const char* configuration = "schema=v2;sensor=BME280;address=0x76;acquisition_contract=v3";
  bool ready = bme.begin(0x76, &Wire);
  if (!ready) {
    ready = bme.begin(0x77, &Wire);
    configuration = "schema=v2;sensor=BME280;address=0x77;acquisition_contract=v3";
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
  const uint32_t now = micros();
  if (!sampler.ready(now)) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t flags = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::TimingLate);
  }

  const uint32_t read_start_us = micros();
  EnvironmentSample sample;
  sample.temperature_c = bme.readTemperature();
  sample.pressure_hpa = bme.readPressure() / 100.0f;
  sample.humidity_pct = bme.readHumidity();
  const uint32_t read_duration_us = micros() - read_start_us;

  const bool valid = isfinite(sample.temperature_c) &&
                     isfinite(sample.pressure_hpa) &&
                     isfinite(sample.humidity_pct);

  betterboard::measurement::AcquisitionResult<EnvironmentSample> acquisition;
  if (valid) {
    acquisition = betterboard::measurement::AcquisitionResult<EnvironmentSample>::success(
        sample, now, read_duration_us);
  } else {
    acquisition = betterboard::measurement::AcquisitionResult<EnvironmentSample>::failure(
        betterboard::measurement::AcquisitionStatus::InvalidValue,
        now,
        read_duration_us);
  }

  const auto record = betterboard::experiments::makeEvidenceRecord(
      sequence_id++, timing.sample_dt_us, acquisition, flags);

  stream.rowBegin(record.timestamp_us);
  if (acquisition.ok()) {
    stream.field(acquisition.value.temperature_c, 4);
    stream.field(acquisition.value.pressure_hpa, 4);
    stream.field(acquisition.value.humidity_pct, 4);
  } else {
    stream.field(""); stream.field(""); stream.field("");
  }
  stream.field(record.sample_dt_us);
  stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
