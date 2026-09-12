#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 20
#endif

Adafruit_MLX90393 mag;
unsigned long last_us = 0;
unsigned int n = 0;
double sx=0, sy=0, sz=0, sx2=0, sy2=0, sz2=0;

void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }

void setup(){ Serial.begin(115200); if(!mag.begin_I2C()) failSensor(); }

void loop(){
  unsigned long now=micros();
  if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return;
  last_us=now;
  float x,y,z; if(!mag.readData(&x,&y,&z)) return;
  sx+=x; sy+=y; sz+=z; sx2+=(double)x*x; sy2+=(double)y*y; sz2+=(double)z*z; n++;
  if(n<BB_WINDOW_SAMPLES) return;
  double mx=sx/n,my=sy/n,mz=sz/n;
  double vx=sx2/n-mx*mx,vy=sy2/n-my*my,vz=sz2/n-mz*mz;
  if(vx<0)vx=0; if(vy<0)vy=0; if(vz<0)vz=0;
  double mm=sqrt(mx*mx+my*my+mz*mz);
  Serial.print(now); Serial.print(','); Serial.print(mx,4); Serial.print(','); Serial.print(my,4); Serial.print(','); Serial.print(mz,4); Serial.print(','); Serial.print(mm,4); Serial.print(','); Serial.print(sqrt(vx),4); Serial.print(','); Serial.print(sqrt(vy),4); Serial.print(','); Serial.println(sqrt(vz),4);
  n=0; sx=sy=sz=sx2=sy2=sz2=0;
}
