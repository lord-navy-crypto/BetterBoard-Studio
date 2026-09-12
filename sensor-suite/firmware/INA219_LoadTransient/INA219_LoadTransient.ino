#include <Wire.h>
#include <Adafruit_INA219.h>
Adafruit_INA219 ina219;
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif
#ifndef BB_TRIGGER_CURRENT_MA
#define BB_TRIGGER_CURRENT_MA 100.0
#endif
unsigned long last_us=0;
bool triggered=false;
unsigned long trigger_us=0;
void setup(){ Serial.begin(115200); if(!ina219.begin()) while(true) delay(100); }
void loop(){
  const unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  const float bus=ina219.getBusVoltage_V(); const float current=ina219.getCurrent_mA(); const float power=ina219.getPower_mW();
  if(!triggered && fabsf(current)>=BB_TRIGGER_CURRENT_MA){ triggered=true; trigger_us=now; }
  const unsigned long since=triggered ? now-trigger_us : 0;
  Serial.print(now); Serial.print(','); Serial.print(bus,5); Serial.print(','); Serial.print(current,4); Serial.print(','); Serial.print(power,4); Serial.print(','); Serial.print(triggered?1:0); Serial.print(','); Serial.println(since);
}
