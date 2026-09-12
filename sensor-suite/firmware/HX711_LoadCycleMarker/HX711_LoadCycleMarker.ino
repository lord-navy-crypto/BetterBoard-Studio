#include <HX711.h>
HX711 scale; const int DOUT_PIN=5, SCK_PIN=6, PHASE_PIN=4; bool lastPhase=HIGH; int phase=0; unsigned long last=0;
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0L
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0f
#endif
void setup(){Serial.begin(115200);pinMode(PHASE_PIN,INPUT_PULLUP);scale.begin(DOUT_PIN,SCK_PIN);}
void loop(){bool s=digitalRead(PHASE_PIN);if(lastPhase==HIGH&&s==LOW){phase=1-phase;delay(20);}lastPhase=s;unsigned long now=micros();if(now-last<100000UL||!scale.is_ready())return;last=now;long raw=scale.read();float f=(raw-BB_OFFSET_COUNTS)/BB_COUNTS_PER_NEWTON;Serial.print(now);Serial.print(',');Serial.print(phase);Serial.print(',');Serial.print(raw);Serial.print(',');Serial.println(f,5);}
