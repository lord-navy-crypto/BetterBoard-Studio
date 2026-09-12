#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif
#ifndef BB_ADC_MAX_CODE
#define BB_ADC_MAX_CODE 1023.0f
#endif
#ifndef BB_ADC_REFERENCE_V
#define BB_ADC_REFERENCE_V 5.0f
#endif

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);

void setup() {
  Serial.begin(115200);
  pinMode(A0, INPUT);
  sampler.arm(micros());
  stream.begin("el-numerical-adc-reference",
               betterboard::experiments::target::NUMERICAL_ERROR_ANALYSIS,
               "time_us,adc_code,normalized,nominal_voltage_v",
               "us,code,1,V",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const int code = analogRead(A0);
  const float normalized = code / float(BB_ADC_MAX_CODE);
  const float nominal_v = normalized * float(BB_ADC_REFERENCE_V);

  stream.rowBegin(now);
  stream.field(code); stream.field(normalized, 7); stream.field(nominal_v, 7);
  stream.rowEnd();
}
