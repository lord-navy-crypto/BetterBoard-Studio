// BetterBoard Sensor Suite — Encoder Reversal / Deadband Evidence
volatile long count=0; volatile uint8_t prev=0; unsigned long last=0; long prevCount=0;
void isr(){uint8_t a=digitalRead(2),b=digitalRead(3),s=(a<<1)|b; int8_t d=0; if((prev==0&&s==1)||(prev==1&&s==3)||(prev==3&&s==2)||(prev==2&&s==0))d=1; else if((prev==0&&s==2)||(prev==2&&s==3)||(prev==3&&s==1)||(prev==1&&s==0))d=-1; count+=d; prev=s;}
void setup(){Serial.begin(115200);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);prev=(digitalRead(2)<<1)|digitalRead(3);attachInterrupt(digitalPinToInterrupt(2),isr,CHANGE);attachInterrupt(digitalPinToInterrupt(3),isr,CHANGE);}
void loop(){unsigned long now=micros();if(now-last<50000UL)return;last=now;noInterrupts();long c=count;interrupts();long dc=c-prevCount;prevCount=c;int dir=(dc>0)-(dc<0);Serial.print(now);Serial.print(',');Serial.print(c);Serial.print(',');Serial.print(dc);Serial.print(',');Serial.println(dir);}
