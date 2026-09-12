#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_Sensor.h>
#include <math.h>
Adafruit_LSM6DSOX imu;
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif
unsigned long last_us=0;
float sum=0,sum2=0,max_abs=0;
unsigned int n=0;
void setup(){ Serial.begin(115200); if(!imu.begin_I2C()) while(true) delay(100); }
void loop(){
  const unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  sensors_event_t a,g,t; imu.getEvent(&a,&g,&t);
  const float z=g.gyro.z; sum+=z; sum2+=z*z; if(fabsf(z)>max_abs) max_abs=fabsf(z); n++;
  if(n<BB_WINDOW_SAMPLES) return;
  const float mean=sum/n; float var=sum2/n-mean*mean; if(var<0)var=0;
  Serial.print(now); Serial.print(','); Serial.print(mean,7); Serial.print(','); Serial.print(sqrtf(var),7); Serial.print(','); Serial.print(max_abs,7); Serial.print(','); Serial.println(n);
  sum=sum2=max_abs=0; n=0;
}
