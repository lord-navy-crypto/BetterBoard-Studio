#include <Wire.h>
#include <Adafruit_VL53L1X.h>
#include <math.h>
Adafruit_VL53L1X tof; const int N=20; int n=0; double s=0,s2=0; unsigned long last=0;
void setup(){Serial.begin(115200);if(!tof.begin(0x29,&Wire))while(true){}tof.startRanging();}
void loop(){unsigned long now=micros();if(now-last<50000UL)return;last=now;if(!tof.dataReady())return;int16_t mm=tof.distance();tof.clearInterrupt();if(mm<0)return;s+=mm;s2+=(double)mm*mm;n++;if(n>=N){double mean=s/N;double var=s2/N-mean*mean;if(var<0)var=0;Serial.print(now);Serial.print(',');Serial.print(mean,3);Serial.print(',');Serial.println(sqrt(var),3);n=0;s=0;s2=0;}}
