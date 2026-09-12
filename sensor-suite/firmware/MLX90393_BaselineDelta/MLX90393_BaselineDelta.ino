#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif
#ifndef BB_BASELINE_SAMPLES
#define BB_BASELINE_SAMPLES 40
#endif

Adafruit_MLX90393 mag;
unsigned long last_us=0;
unsigned int baseline_n=0;
double bx0=0,by0=0,bz0=0;
bool ready=false;

void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }
void setup(){ Serial.begin(115200); if(!mag.begin_I2C()) failSensor(); }
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  float x,y,z; if(!mag.readData(&x,&y,&z)) return;
  if(!ready){ bx0+=x; by0+=y; bz0+=z; baseline_n++; if(baseline_n>=BB_BASELINE_SAMPLES){ bx0/=baseline_n; by0/=baseline_n; bz0/=baseline_n; ready=true; } return; }
  double dx=x-bx0,dy=y-by0,dz=z-bz0,dm=sqrt(dx*dx+dy*dy+dz*dz);
  Serial.print(now); Serial.print(','); Serial.print(x,4); Serial.print(','); Serial.print(y,4); Serial.print(','); Serial.print(z,4); Serial.print(','); Serial.print(dx,4); Serial.print(','); Serial.print(dy,4); Serial.print(','); Serial.print(dz,4); Serial.print(','); Serial.println(dm,4);
}
