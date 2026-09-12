// BetterBoard Sensor Suite — Photogate speed and kinetic energy per unit mass
#ifndef BB_OBJECT_WIDTH_MM
#define BB_OBJECT_WIDTH_MM 20.0f
#endif
const int GATE_PIN=2; volatile unsigned long blockStart=0,blockEnd=0; volatile bool ready=false;
void gateISR(){bool blocked=digitalRead(GATE_PIN)==LOW;unsigned long now=micros();if(blocked)blockStart=now;else if(blockStart){blockEnd=now;ready=true;}}
void setup(){Serial.begin(115200);pinMode(GATE_PIN,INPUT_PULLUP);attachInterrupt(digitalPinToInterrupt(GATE_PIN),gateISR,CHANGE);}
void loop(){if(!ready)return;noInterrupts();unsigned long a=blockStart,b=blockEnd;ready=false;interrupts();if(b<=a)return;float dt=(b-a)*1e-6f;float v=(BB_OBJECT_WIDTH_MM*1e-3f)/dt;float ePerM=0.5f*v*v;Serial.print(b);Serial.print(',');Serial.print(b-a);Serial.print(',');Serial.print(v,6);Serial.print(',');Serial.println(ePerM,6);}
