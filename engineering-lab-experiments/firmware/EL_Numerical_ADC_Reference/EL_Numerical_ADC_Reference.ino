#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif
#ifndef BB_ADC_MAX_CODE
#define BB_ADC_MAX_CODE 1023.0f
#define BB_ADC_MAX_CODE_DEFAULT 1
#else
#define BB_ADC_MAX_CODE_DEFAULT 0
#endif
#ifndef BB_ADC_REFERENCE_V
#define BB_ADC_REFERENCE_V 5.0f
#define BB_ADC_REFERENCE_DEFAULT 1
#else
#define BB_ADC_REFERENCE_DEFAULT 0
#endif

#define BB_STRINGIFY_INNER(x) #x
#define BB_STRINGIFY(x) BB_STRINGIFY_INNER(x)

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0U;

void setup() {
  Serial.begin(115200);
  pinMode(A0, INPUT);
  sampler.arm(micros());
  stream.begin("el-numerical-adc-reference",
               betterboard::experiments::target::NUMERICAL_ERROR_ANALYSIS,
               "time_us,adc_code,normalized,nominal_voltage_v,quantization_lsb_v,sample_dt_us,read_duration_us,quality_flags",
               "us,code,1,V,V,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;input=A0;adc_max_code=" BB_STRINGIFY(BB_ADC_MAX_CODE) ";adc_reference_v=" BB_STRINGIFY(BB_ADC_REFERENCE_V) ";acquisition_contract=v3");
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
#if BB_ADC_MAX_CODE_DEFAULT || BB_ADC_REFERENCE_DEFAULT
  flags = betterboard::experiments::evidence::addFlag(
      flags, betterboard::experiments::evidence::CalibrationDefault);
#endif

  const uint32_t read_start_us = micros();
  const int code = analogRead(A0);
  const uint32_t read_duration_us = micros() - read_start_us;

  const auto acquisition =
      betterboard::measurement::AcquisitionResult<int>::success(
          code, now, read_duration_us);

  if (code <= 0 || code >= int(BB_ADC_MAX_CODE)) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::Saturated);
  }

  const auto record = betterboard::experiments::makeEvidenceRecord(
      sequence_id++, timing.sample_dt_us, acquisition, flags);

  const float normalized = acquisition.value / float(BB_ADC_MAX_CODE);
  const float nominal_v = normalized * float(BB_ADC_REFERENCE_V);
  const float quantization_lsb_v = float(BB_ADC_REFERENCE_V) / float(BB_ADC_MAX_CODE);

  stream.rowBegin(record.timestamp_us);
  stream.field(acquisition.value);
  stream.field(normalized, 7);
  stream.field(nominal_v, 7);
  stream.field(quantization_lsb_v, 9);
  stream.field(record.sample_dt_us);
  stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
