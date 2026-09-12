#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>

#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

Adafruit_LSM6DSOX imu;
volatile long encoder_count=0;
volatile uint8_t last_state=0;
unsigned long last_us=0;

void encoderISR(){
  uint8_t a=(uint8_t)digitalRead(2), b=(uint8_t)digitalRead(3);
  uint8_t state=(a<<1)|b;
  static const int8_t table[16]={0,-1,1,0,1,0,0,-1,-1,0,0,1,0,1,-1,0};
  encoder_count += table[(last_state<<2)|state];
  last_state=state;
}
void failSensor(){ pinMode(LED_BUILTIN,OUTPUT); while(true){ digitalWrite(LED_BUILTIN,HIGH); delay(120); digitalWrite(LED_BUILTIN,LOW); delay(120);} }
void setup(){
  Serial.begin(115200); if(!imu.begin_I2C()) failSensor();
  pinMode(2,INPUT_PULLUP); pinMode(3,INPUT_PULLUP); last_state=((uint8_t)digitalRead(2)<<1)|(uint8_t)digitalRead(3);
  attachInterrupt(digitalPinToInterrupt(2),encoderISR,CHANGE); attachInterrupt(digitalPinToInterrupt(3),encoderISR,CHANGE);
}
void loop(){
  unsigned long now=micros(); if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return; last_us=now;
  long c; noInterrupts(); c=encoder_count; interrupts();
  sensors_event_t a,g,t; imu.getEvent(&a,&g,&t);
  float angle=(360.0f*c)/BB_COUNTS_PER_REVOLUTION;
  Serial.print(now); Serial.print(','); Serial.print(c); Serial.print(','); Serial.print(angle,5); Serial.print(','); Serial.print(a.acceleration.x,5); Serial.print(','); Serial.print(a.acceleration.y,5); Serial.print(','); Serial.print(a.acceleration.z,5); Serial.print(','); Serial.print(g.gyro.x,6); Serial.print(','); Serial.print(g.gyro.y,6); Serial.print(','); Serial.println(g.gyro.z,6);
}
