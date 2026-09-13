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

betterboard::measurement::AcquisitionStatus readEnvironment(
    void* context, EnvironmentSample& sample) {
  Adafruit_BME280* sensor = static_cast<Adafruit_BME280*>(context);
  sample.temperature_c = sensor->readTemperature();
  sample.pressure_hpa = sensor->readPressure() / 100.0f;
  sample.humidity_pct = sensor->readHumidity();
  if (!isfinite(sample.temperature_c) ||
      !isfinite(sample.pressure_hpa) ||
      !isfinite(sample.humidity_pct)) {
    return betterboard::measurement::AcquisitionStatus::InvalidValue;
  }
  return betterboard::measurement::AcquisitionStatus::Ok;
}

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::core::ArduinoClock acquisition_clock;
betterboard::hal::ClockedSensorAdapter<EnvironmentSample> sensor_adapter(
    acquisition_clock, &bme, readEnvironment);
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
  const char* configuration = "schema=v2;sensor=BME280;address=0x76;acquisition_contract=v3;hal_adapter=clocked";
  bool ready = bme.begin(0x76, &Wire);
  if (!ready) {
    ready = bme.begin(0x77, &Wire);
    configuration = "schema=v2;sensor=BME280;address=0x77;acquisition_contract=v3;hal_adapter=clocked";
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

  const auto acquisition = sensor_adapter.readAt(now);
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
