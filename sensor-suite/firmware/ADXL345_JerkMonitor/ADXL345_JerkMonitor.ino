#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
Adafruit_ADXL345_Unified accel(34501);
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
unsigned long last_us = 0;
float pax=0, pay=0, paz=0;
bool have_prev=false;
void setup(){
  Serial.begin(115200);
  if(!accel.begin()) while(true) delay(100);
  accel.setRange(ADXL345_RANGE_16_G);
  last_us = micros();
}
void loop(){
  const unsigned long now=micros();
  const unsigned long dt_us=now-last_us;
  if(dt_us < BB_SAMPLE_INTERVAL_US) return;
  last_us=now;
  sensors_event_t e; accel.getEvent(&e);
  const float dt=(float)dt_us*1.0e-6f;
  float jx=0,jy=0,jz=0;
  if(have_prev && dt>0){ jx=(e.acceleration.x-pax)/dt; jy=(e.acceleration.y-pay)/dt; jz=(e.acceleration.z-paz)/dt; }
  const float jmag=sqrtf(jx*jx+jy*jy+jz*jz);
  pax=e.acceleration.x; pay=e.acceleration.y; paz=e.acceleration.z; have_prev=true;
  Serial.print(now); Serial.print(','); Serial.print(e.acceleration.x,5); Serial.print(','); Serial.print(e.acceleration.y,5); Serial.print(','); Serial.print(e.acceleration.z,5); Serial.print(','); Serial.print(jx,5); Serial.print(','); Serial.print(jy,5); Serial.print(','); Serial.print(jz,5); Serial.print(','); Serial.println(jmag,5);
}
