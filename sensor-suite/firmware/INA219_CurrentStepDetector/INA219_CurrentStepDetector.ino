#include <Wire.h>
#include <Adafruit_INA219.h>
#include <math.h>
Adafruit_INA219 ina; unsigned long last=0; float prev=0;
#ifndef BB_STEP_THRESHOLD_MA
#define BB_STEP_THRESHOLD_MA 50.0f
#endif
void setup(){Serial.begin(115200);if(!ina.begin())while(true){}}
void loop(){unsigned long now=micros();if(now-last<20000UL)return;last=now;float current=ina.getCurrent_mA();float voltage=ina.getBusVoltage_V();float power=ina.getPower_mW();float delta=current-prev;prev=current;int step=fabs(delta)>=BB_STEP_THRESHOLD_MA;Serial.print(now);Serial.print(',');Serial.print(voltage,5);Serial.print(',');Serial.print(current,4);Serial.print(',');Serial.print(power,4);Serial.print(',');Serial.print(delta,4);Serial.print(',');Serial.println(step);}
