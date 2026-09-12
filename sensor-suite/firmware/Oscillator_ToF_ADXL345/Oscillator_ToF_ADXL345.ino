#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <Adafruit_VL53L1X.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif

Adafruit_ADXL345_Unified accel=Adafruit_ADXL345_Unified(34502);
Adafruit_VL53L1X tof;
unsigned long last_us=0;

void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }
void setup(){
  Serial.begin(115200);
  if(!accel.begin()) failSensor();
  if(!tof.begin(0x29,&Wire)) failSensor();
  if(!tof.startRanging()) failSensor();
}
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  if(!tof.dataReady()) return;
  int16_t mm=tof.distance(); tof.clearInterrupt();
  sensors_event_t e; accel.getEvent(&e);
  Serial.print(now); Serial.print(','); Serial.print(mm); Serial.print(','); Serial.print(e.acceleration.x,5); Serial.print(','); Serial.print(e.acceleration.y,5); Serial.print(','); Serial.println(e.acceleration.z,5);
}
