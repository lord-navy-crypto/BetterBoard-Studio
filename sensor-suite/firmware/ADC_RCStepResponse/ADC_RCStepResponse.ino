// BetterBoard Sensor Suite — ADC RC Step Response
// Low-voltage RC only. D9 drives a bounded PWM step; A0 measures the capacitor node.
#ifndef BB_PWM_COMMAND
#define BB_PWM_COMMAND 128
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 2000UL
#endif
const int PWM_PIN=9, ADC_PIN=A0; unsigned long t0=0,last=0; bool stepped=false;
void setup(){Serial.begin(115200);pinMode(PWM_PIN,OUTPUT);analogWrite(PWM_PIN,0);t0=micros();}
void loop(){unsigned long now=micros(); if(!stepped && now-t0>=500000UL){analogWrite(PWM_PIN,BB_PWM_COMMAND);stepped=true;t0=now;} if(now-last<BB_SAMPLE_INTERVAL_US)return; last=now; Serial.print(now);Serial.print(',');Serial.print(stepped?BB_PWM_COMMAND:0);Serial.print(',');Serial.println(analogRead(ADC_PIN));}
