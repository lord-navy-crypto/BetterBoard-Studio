#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
#include <math.h>
Adafruit_LSM6DSOX imu; float peak=0; unsigned long last=0,windowStart=0;
void setup(){Serial.begin(115200);if(!imu.begin_I2C())while(true){} windowStart=micros();}
void loop(){unsigned long now=micros();if(now-last<5000UL)return;last=now;sensors_event_t a,g,t;imu.getEvent(&a,&g,&t);float m=sqrtf(a.acceleration.x*a.acceleration.x+a.acceleration.y*a.acceleration.y+a.acceleration.z*a.acceleration.z);if(m>peak)peak=m;if(now-windowStart>=500000UL){Serial.print(now);Serial.print(',');Serial.print(m,4);Serial.print(',');Serial.println(peak,4);peak=0;windowStart=now;}}
