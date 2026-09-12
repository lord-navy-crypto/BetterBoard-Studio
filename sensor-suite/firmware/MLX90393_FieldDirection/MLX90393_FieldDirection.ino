#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <math.h>
Adafruit_MLX90393 mag;
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif
#ifndef BB_BASELINE_SAMPLES
#define BB_BASELINE_SAMPLES 20
#endif
unsigned long last_us=0;
float bx0=0,by0=0,bz0=0;
unsigned int n0=0;
void setup(){ Serial.begin(115200); if(!mag.begin_I2C()) while(true) delay(100); }
void loop(){
  const unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  float bx,by,bz; if(!mag.readData(&bx,&by,&bz)) return;
  if(n0<BB_BASELINE_SAMPLES){ bx0+=bx; by0+=by; bz0+=bz; n0++; if(n0==BB_BASELINE_SAMPLES){ bx0/=n0; by0/=n0; bz0/=n0; } }
  const bool ready=n0>=BB_BASELINE_SAMPLES;
  const float m=sqrtf(bx*bx+by*by+bz*bz); const float m0=sqrtf(bx0*bx0+by0*by0+bz0*bz0);
  float angle=0.0f;
  if(ready && m>0 && m0>0){ float c=(bx*bx0+by*by0+bz*bz0)/(m*m0); if(c>1)c=1; if(c<-1)c=-1; angle=acosf(c)*57.2957795f; }
  Serial.print(now); Serial.print(','); Serial.print(bx,4); Serial.print(','); Serial.print(by,4); Serial.print(','); Serial.print(bz,4); Serial.print(','); Serial.print(m,4); Serial.print(','); Serial.print(angle,4); Serial.print(','); Serial.println(ready?1:0);
}
