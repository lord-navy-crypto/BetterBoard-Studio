#include <Wire.h>
#include <Adafruit_INA219.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif
#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 20
#endif

Adafruit_INA219 ina;
unsigned long last_us=0;
unsigned int n=0;
double sv=0,si=0,sp=0,sv2=0,si2=0,sp2=0;

void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }
void setup(){ Serial.begin(115200); if(!ina.begin()) failSensor(); }
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  double v=ina.getBusVoltage_V()+ina.getShuntVoltage_mV()/1000.0;
  double i=ina.getCurrent_mA(); double p=ina.getPower_mW();
  sv+=v; si+=i; sp+=p; sv2+=v*v; si2+=i*i; sp2+=p*p; n++;
  if(n<BB_WINDOW_SAMPLES) return;
  double mv=sv/n,mi=si/n,mp=sp/n; double vv=sv2/n-mv*mv,vi=si2/n-mi*mi,vp=sp2/n-mp*mp;
  if(vv<0)vv=0; if(vi<0)vi=0; if(vp<0)vp=0;
  Serial.print(now); Serial.print(','); Serial.print(mv,6); Serial.print(','); Serial.print(mi,4); Serial.print(','); Serial.print(mp,4); Serial.print(','); Serial.print(sqrt(vv),6); Serial.print(','); Serial.print(sqrt(vi),4); Serial.print(','); Serial.println(sqrt(vp),4);
  n=0; sv=si=sp=sv2=si2=sp2=0;
}
