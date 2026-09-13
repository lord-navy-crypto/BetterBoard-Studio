#include <Wire.h>
#include <Adafruit_INA219.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif

struct PowerSample {
  float bus_v;
  float current_ma;
  float power_mw;
};

Adafruit_INA219 ina219;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::math::TrapezoidIntegrator energy;
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0;

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(180);
    digitalWrite(LED_BUILTIN, LOW); delay(180);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!ina219.begin()) failSensor();
  sampler.arm(micros());
  stream.begin("el-power-context-ina219",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,bus_v,current_ma,power_mw,energy_mj,integration_dt_us,read_duration_us,quality_flags",
               "us,V,mA,mW,mJ,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;sensor=INA219;energy_method=trapezoid;timebase=actual_sample_time;acquisition_contract=v3");
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t flags = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::TimingLate);
  }
  if (timing.sample_dt_us == 0U) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::DerivedUnavailable);
  }

  const unsigned long read_start_us = micros();
  PowerSample sample;
  sample.bus_v = ina219.getBusVoltage_V();
  sample.current_ma = ina219.getCurrent_mA();
  sample.power_mw = ina219.getPower_mW();
  const unsigned long read_duration_us = micros() - read_start_us;

  betterboard::measurement::AcquisitionResult<PowerSample> acquisition;
  if (isfinite(sample.bus_v) && isfinite(sample.current_ma) && isfinite(sample.power_mw)) {
    acquisition = betterboard::measurement::AcquisitionResult<PowerSample>::success(
        sample, now, read_duration_us);
    energy.push(now * 1.0e-6, sample.power_mw);
  } else {
    acquisition = betterboard::measurement::AcquisitionResult<PowerSample>::failure(
        betterboard::measurement::AcquisitionStatus::InvalidValue,
        now,
        read_duration_us);
  }

  const betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          ++sequence_id, timing.sample_dt_us, acquisition, flags);

  stream.rowBegin(record.timestamp_us);
  if (record.usable()) {
    stream.field(acquisition.value.bus_v, 6);
    stream.field(acquisition.value.current_ma, 6);
    stream.field(acquisition.value.power_mw, 6);
    stream.field(energy.value(), 6);
  } else {
    stream.field(""); stream.field(""); stream.field(""); stream.field("");
  }
  stream.field(record.sample_dt_us);
  stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
