#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <math.h>

#ifndef BB_WINDOW_SAMPLES
#define BB_WINDOW_SAMPLES 100
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

Adafruit_LSM6DSOX imu;
unsigned long last_us=0;
unsigned int n=0;
double sax=0,say=0,saz=0,sgx=0,sgy=0,sgz=0;
double sax2=0,say2=0,saz2=0,sgx2=0,sgy2=0,sgz2=0;

void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }
void setup(){ Serial.begin(115200); if(!imu.begin_I2C()) failSensor(); }
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  sensors_event_t a,g,t; imu.getEvent(&a,&g,&t);
  double ax=a.acceleration.x, ay=a.acceleration.y, az=a.acceleration.z, gx=g.gyro.x, gy=g.gyro.y, gz=g.gyro.z;
  sax+=ax; say+=ay; saz+=az; sgx+=gx; sgy+=gy; sgz+=gz;
  sax2+=ax*ax; say2+=ay*ay; saz2+=az*az; sgx2+=gx*gx; sgy2+=gy*gy; sgz2+=gz*gz; n++;
  if(n<BB_WINDOW_SAMPLES) return;
  double max=sax/n, may=say/n, maz=saz/n, mgx=sgx/n, mgy=sgy/n, mgz=sgz/n;
  double vgx=sgx2/n-mgx*mgx, vgy=sgy2/n-mgy*mgy, vgz=sgz2/n-mgz*mgz;
  if(vgx<0)vgx=0; if(vgy<0)vgy=0; if(vgz<0)vgz=0;
  Serial.print(now); Serial.print(','); Serial.print(max,6); Serial.print(','); Serial.print(may,6); Serial.print(','); Serial.print(maz,6); Serial.print(','); Serial.print(mgx,7); Serial.print(','); Serial.print(mgy,7); Serial.print(','); Serial.print(mgz,7); Serial.print(','); Serial.print(sqrt(vgx),7); Serial.print(','); Serial.print(sqrt(vgy),7); Serial.print(','); Serial.println(sqrt(vgz),7);
  n=0; sax=say=saz=sgx=sgy=sgz=sax2=say2=saz2=sgx2=sgy2=sgz2=0;
}
