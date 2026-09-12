#include <HX711.h>
HX711 scale;
constexpr uint8_t DOUT_PIN=4;
constexpr uint8_t SCK_PIN=5;
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif
#ifndef BB_BASELINE_SAMPLES
#define BB_BASELINE_SAMPLES 20
#endif
unsigned long last_us=0;
long baseline=0;
unsigned int n0=0;
void setup(){ Serial.begin(115200); scale.begin(DOUT_PIN,SCK_PIN); }
void loop(){
  const unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  if(!scale.is_ready()) return;
  const long raw=scale.read();
  if(n0<BB_BASELINE_SAMPLES){ baseline += raw; n0++; if(n0==BB_BASELINE_SAMPLES) baseline/=BB_BASELINE_SAMPLES; }
  const bool ready=n0>=BB_BASELINE_SAMPLES; const long drift=ready ? raw-baseline : 0;
  Serial.print(now); Serial.print(','); Serial.print(raw); Serial.print(','); Serial.print(baseline); Serial.print(','); Serial.print(drift); Serial.print(','); Serial.println(ready?1:0);
}
