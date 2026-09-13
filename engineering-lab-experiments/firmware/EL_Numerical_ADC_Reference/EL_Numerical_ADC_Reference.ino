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
betterboard::experiments::EngineeringLabStream stream(Serial);
unsigned long previous_sample_us = 0;

void setup() {
  Serial.begin(115200);
  pinMode(A0, INPUT);
  sampler.arm(micros());
  stream.begin("el-numerical-adc-reference",
               betterboard::experiments::target::NUMERICAL_ERROR_ANALYSIS,
               "time_us,adc_code,normalized,nominal_voltage_v,quantization_lsb_v,sample_dt_us,read_duration_us,quality_flags",
               "us,code,1,V,V,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;input=A0;adc_max_code=" BB_STRINGIFY(BB_ADC_MAX_CODE) ";adc_reference_v=" BB_STRINGIFY(BB_ADC_REFERENCE_V));
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
#if BB_ADC_MAX_CODE_DEFAULT || BB_ADC_REFERENCE_DEFAULT
  quality = betterboard::experiments::evidence::addFlag(
      quality, betterboard::experiments::evidence::CalibrationDefault);
#endif

  const unsigned long read_start_us = micros();
  const int code = analogRead(A0);
  const unsigned long read_duration_us = micros() - read_start_us;
  if (code <= 0 || code >= int(BB_ADC_MAX_CODE)) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::Saturated);
  }

  const float normalized = code / float(BB_ADC_MAX_CODE);
  const float nominal_v = normalized * float(BB_ADC_REFERENCE_V);
  const float quantization_lsb_v = float(BB_ADC_REFERENCE_V) / float(BB_ADC_MAX_CODE);

  stream.rowBegin(now);
  stream.field(code); stream.field(normalized, 7); stream.field(nominal_v, 7);
  stream.field(quantization_lsb_v, 9); stream.field(sample_dt_us); stream.field(read_duration_us);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
