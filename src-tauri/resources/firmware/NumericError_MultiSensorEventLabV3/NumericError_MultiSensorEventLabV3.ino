#include <Arduino.h>

// BetterBoard Numeric Error Depth — MultiSensor Event Lab V3
// Consolidates legacy MultiSensorEventLab V1/V2. This is a sampled-context lab:
// A0 + EMA + PWM + PIR + switch are sampled at 50 Hz while photogate event
// counts preserve multiplicity between samples. It intentionally does not claim
// one sample row per photogate edge; InteractiveStudioV2 owns that event-queue use case.

const uint8_t POT_PIN=A0, PHOTO_PIN=2, PIR_PIN=3, SWITCH_PIN=4, LED_PIN=9;
const uint32_t BAUD=115200, SAMPLE_INTERVAL_US=20000UL, MIN_EDGE_US=2000UL;
volatile uint32_t photoLastUs=0, photoPeriodUs=0, photoAcceptedTotal=0, photoRejectedTotal=0;
volatile uint16_t acceptedSinceSample=0, rejectedSinceSample=0;
uint32_t nextSampleUs=0, previousSampleUs=0;
float filtered=0.0f; bool filterInit=false;

void onPhotoEdge(){
  const uint32_t now=micros();
  if(photoLastUs!=0){
    const uint32_t dt=now-photoLastUs;
    if(dt<MIN_EDGE_US){ photoRejectedTotal++; if(rejectedSinceSample<65535) rejectedSinceSample++; return; }
    photoPeriodUs=dt;
  }
  photoLastUs=now; photoAcceptedTotal++; if(acceptedSinceSample<65535) acceptedSinceSample++;
}

void setup(){
  Serial.begin(BAUD); pinMode(POT_PIN,INPUT); pinMode(PHOTO_PIN,INPUT_PULLUP); pinMode(PIR_PIN,INPUT);
  pinMode(SWITCH_PIN,INPUT_PULLUP); pinMode(LED_PIN,OUTPUT); attachInterrupt(digitalPinToInterrupt(PHOTO_PIN),onPhotoEdge,FALLING);
  nextSampleUs=micros();
  Serial.println("sample_us,scheduled_us,lateness_us,dt_us,raw_adc,nominal_voltage_v,filtered_v,filter_residual_v,pwm8,pir_state,switch_state,photo_period_us,photo_frequency_hz,photo_accepted_total,photo_events_since_sample,photo_multiple_events,photo_rejected_since_sample,photo_rejected_total");
}

void loop(){
  const uint32_t now=micros(); if((int32_t)(now-nextSampleUs)<0) return;
  const uint32_t scheduled=nextSampleUs; nextSampleUs+=SAMPLE_INTERVAL_US; const uint32_t sampleUs=micros();
  const uint32_t dtUs=previousSampleUs==0?0:sampleUs-previousSampleUs; previousSampleUs=sampleUs;
  const int raw=analogRead(POT_PIN); const float voltage=raw*5.0f/1023.0f;
  if(!filterInit){ filtered=voltage; filterInit=true; } else filtered+=0.20f*(voltage-filtered);
  const uint8_t pwm=(uint8_t)(((uint32_t)raw*255UL+511UL)/1023UL); analogWrite(LED_PIN,pwm);
  noInterrupts(); const uint32_t period=photoPeriodUs, total=photoAcceptedTotal, rejectedAll=photoRejectedTotal;
  const uint16_t events=acceptedSinceSample, rejected=rejectedSinceSample; acceptedSinceSample=0; rejectedSinceSample=0; interrupts();
  const float hz=period>0?1000000.0f/(float)period:0.0f;
  Serial.print(sampleUs);Serial.print(',');Serial.print(scheduled);Serial.print(',');Serial.print(sampleUs-scheduled);Serial.print(',');Serial.print(dtUs);Serial.print(',');
  Serial.print(raw);Serial.print(',');Serial.print(voltage,7);Serial.print(',');Serial.print(filtered,7);Serial.print(',');Serial.print(filtered-voltage,7);Serial.print(',');
  Serial.print(pwm);Serial.print(',');Serial.print(digitalRead(PIR_PIN));Serial.print(',');Serial.print(digitalRead(SWITCH_PIN));Serial.print(',');
  Serial.print(period);Serial.print(',');Serial.print(hz,7);Serial.print(',');Serial.print(total);Serial.print(',');Serial.print(events);Serial.print(',');
  Serial.print(events>1?1:0);Serial.print(',');Serial.print(rejected);Serial.print(',');Serial.println(rejectedAll);
}
