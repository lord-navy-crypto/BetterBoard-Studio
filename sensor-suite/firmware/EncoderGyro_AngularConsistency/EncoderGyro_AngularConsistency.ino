#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
Adafruit_LSM6DSOX imu; volatile long count=0; volatile uint8_t prev=0; unsigned long last=0; long lastCount=0;
#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#endif
void encISR(){uint8_t s=(digitalRead(2)<<1)|digitalRead(3);int8_t d=0;if((prev==0&&s==1)||(prev==1&&s==3)||(prev==3&&s==2)||(prev==2&&s==0))d=1;else if((prev==0&&s==2)||(prev==2&&s==3)||(prev==3&&s==1)||(prev==1&&s==0))d=-1;count+=d;prev=s;}
void setup(){Serial.begin(115200);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);prev=(digitalRead(2)<<1)|digitalRead(3);attachInterrupt(digitalPinToInterrupt(2),encISR,CHANGE);attachInterrupt(digitalPinToInterrupt(3),encISR,CHANGE);if(!imu.begin_I2C())while(true){}}
void loop(){unsigned long now=micros();if(now-last<20000UL)return;float dt=(now-last)*1e-6f;last=now;noInterrupts();long c=count;interrupts();long dc=c-lastCount;lastCount=c;float encOmega=(dc/BB_COUNTS_PER_REVOLUTION)*6.28318530718f/dt;sensors_event_t a,g,t;imu.getEvent(&a,&g,&t);float diff=encOmega-g.gyro.z;Serial.print(now);Serial.print(',');Serial.print(encOmega,6);Serial.print(',');Serial.print(g.gyro.z,6);Serial.print(',');Serial.println(diff,6);}
