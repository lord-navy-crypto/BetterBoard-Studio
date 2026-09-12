#include <Wire.h>
#include <Adafruit_VL53L1X.h>
Adafruit_VL53L1X tof;
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif
#ifndef BB_BASELINE_SAMPLES
#define BB_BASELINE_SAMPLES 20
#endif
unsigned long last_us=0;
float baseline_mm=0.0f;
unsigned int baseline_n=0;
void setup(){
  Serial.begin(115200);
  Wire.begin();
  if(!tof.begin(0x29,&Wire)) while(true) delay(100);
  if(!tof.startRanging()) while(true) delay(100);
}
void loop(){
  const unsigned long now=micros();
  if((unsigned long)(now-last_us)<BB_SAMPLE_INTERVAL_US) return;
  last_us=now;
  if(!tof.dataReady()) return;
  const int16_t mm=tof.distance(); tof.clearInterrupt();
  if(mm<=0) return;
  if(baseline_n<BB_BASELINE_SAMPLES){ baseline_mm += (float)mm; baseline_n++; if(baseline_n==BB_BASELINE_SAMPLES) baseline_mm/=BB_BASELINE_SAMPLES; }
  const bool ready=baseline_n>=BB_BASELINE_SAMPLES;
  const float displacement=ready ? ((float)mm-baseline_mm) : 0.0f;
  const float abs_disp=fabsf(displacement);
  Serial.print(now); Serial.print(','); Serial.print(mm); Serial.print(','); Serial.print(baseline_mm,3); Serial.print(','); Serial.print(displacement,3); Serial.print(','); Serial.print(abs_disp,3); Serial.print(','); Serial.println(ready?1:0);
}
