#include <Wire.h>
#include <Adafruit_BME280.h>
#include <math.h>
Adafruit_BME280 bme; unsigned long last=0;
void setup(){Serial.begin(115200);if(!bme.begin(0x76)&&!bme.begin(0x77))while(true){}}
void loop(){unsigned long now=micros();if(now-last<1000000UL)return;last=now;float t=bme.readTemperature(),rh=bme.readHumidity();float a=17.62f,b=243.12f;float g=logf(rh/100.0f)+(a*t)/(b+t);float dew=(b*g)/(a-g);Serial.print(now);Serial.print(',');Serial.print(t,3);Serial.print(',');Serial.print(rh,3);Serial.print(',');Serial.println(dew,3);}
