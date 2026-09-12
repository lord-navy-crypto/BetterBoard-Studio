#include <Wire.h>
#include <Adafruit_MLX90393.h>
Adafruit_MLX90393 mag;
#ifndef BB_STEP_MM
#define BB_STEP_MM 5.0f
#endif
const int STEP_PIN=4; bool lastState=HIGH; unsigned long lastEdge=0; int indexN=0; double integral=0; float prevBz=0; bool havePrev=false;
void setup(){Serial.begin(115200);pinMode(STEP_PIN,INPUT_PULLUP);if(!mag.begin_I2C())while(true){}}
void loop(){bool s=digitalRead(STEP_PIN);unsigned long now=millis();if(lastState==HIGH&&s==LOW&&now-lastEdge>150){lastEdge=now;float bx,by,bz;if(mag.readData(&bx,&by,&bz)){if(havePrev)integral+=0.5*(prevBz+bz)*BB_STEP_MM;prevBz=bz;havePrev=true;Serial.print(indexN);Serial.print(',');Serial.print(indexN*BB_STEP_MM,3);Serial.print(',');Serial.print(bx,4);Serial.print(',');Serial.print(by,4);Serial.print(',');Serial.print(bz,4);Serial.print(',');Serial.println(integral,4);indexN++;}}lastState=s;}
