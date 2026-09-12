#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(34501);
unsigned long last_us=0;

void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }
void setup(){ Serial.begin(115200); if(!accel.begin()) failSensor(); accel.setRange(ADXL345_RANGE_4_G); }
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  sensors_event_t e; accel.getEvent(&e);
  float ax=e.acceleration.x, ay=e.acceleration.y, az=e.acceleration.z;
  float roll=atan2f(ay,az)*180.0f/PI;
  float pitch=atan2f(-ax,sqrtf(ay*ay+az*az))*180.0f/PI;
  float amag=sqrtf(ax*ax+ay*ay+az*az);
  Serial.print(now); Serial.print(','); Serial.print(ax,5); Serial.print(','); Serial.print(ay,5); Serial.print(','); Serial.print(az,5); Serial.print(','); Serial.print(amag,5); Serial.print(','); Serial.print(roll,4); Serial.print(','); Serial.println(pitch,4);
}
