#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <math.h>
Adafruit_BME280 bme;
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 500000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 20
#endif
unsigned long last_us=0;
float sum_t=0,sum_t2=0,sum_h=0,sum_p=0;
unsigned int n=0;
void setup(){ Serial.begin(115200); if(!bme.begin(0x76) && !bme.begin(0x77)) while(true) delay(100); }
void loop(){
  const unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  const float t=bme.readTemperature(); const float h=bme.readHumidity(); const float p=bme.readPressure()/100.0f;
  sum_t+=t; sum_t2+=t*t; sum_h+=h; sum_p+=p; n++;
  if(n<BB_WINDOW_SAMPLES) return;
  const float mt=sum_t/n, mh=sum_h/n, mp=sum_p/n; float var=sum_t2/n-mt*mt; if(var<0)var=0;
  Serial.print(now); Serial.print(','); Serial.print(mt,4); Serial.print(','); Serial.print(sqrtf(var),5); Serial.print(','); Serial.print(mh,4); Serial.print(','); Serial.println(mp,4);
  sum_t=sum_t2=sum_h=sum_p=0; n=0;
}
