#include <HX711.h>

#ifndef BB_DOUT_PIN
#define BB_DOUT_PIN 4
#endif
#ifndef BB_SCK_PIN
#define BB_SCK_PIN 5
#endif
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0L
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0f
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif

HX711 scale;
unsigned long last_us=0, start_ms=0;
float baseline_force=0.0f;
bool baseline_set=false;

void setup(){ Serial.begin(115200); scale.begin(BB_DOUT_PIN,BB_SCK_PIN); start_ms=millis(); }
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  if(!scale.is_ready()) return;
  long raw=scale.read_average(5); long corrected=raw-BB_OFFSET_COUNTS; float force=corrected/BB_COUNTS_PER_NEWTON;
  if(!baseline_set){ baseline_force=force; baseline_set=true; }
  float delta=force-baseline_force;
  Serial.print(millis()-start_ms); Serial.print(','); Serial.print(raw); Serial.print(','); Serial.print(force,6); Serial.print(','); Serial.print(baseline_force,6); Serial.print(','); Serial.println(delta,6);
}
