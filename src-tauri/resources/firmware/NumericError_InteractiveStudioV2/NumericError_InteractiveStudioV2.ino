#include <Arduino.h>
#include <math.h>
#include <float.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

// BetterBoard Numeric Error Interactive Studio V2
// Target: Arduino UNO-class AVR
// A0 pot, D2 photogate, D3 PIR, D4 switch, D9 LED
// V2 keeps measurement rows numeric-only and preserves photogate event evidence
// with an ISR timestamp queue + explicit dropped-event counter.

const uint32_t BAUD = 115200;
const uint8_t POT_PIN = A0, PHOTO_PIN = 2, PIR_PIN = 3, SWITCH_PIN = 4, LED_PIN = 9;
const uint8_t METHOD_RAW = 0, METHOD_REDUCED = 1;
const uint8_t SOURCE_SERIAL = 0, SOURCE_SWEEP = 1, SOURCE_LIVE = 2, SOURCE_PHOTO = 3;
const uint8_t MODE_IDLE = 0, MODE_LIVE = 1, MODE_PHOTO = 2, MODE_SWEEP = 3;

struct TaylorResult {
  float reducedX, approximation, lastTerm, cancellationRatio;
  uint16_t termsUsed;
  bool stoppingMet, finite;
};

uint8_t selectedMethod = METHOD_REDUCED;
uint16_t maxTerms = 80;
float toleranceMultiplier = 8.0f;
float currentX = 1.57079632679f;
float rangeMin = -3.14159265f, rangeMax = 3.14159265f;
uint16_t sweepPoints = 101, sweepIndex = 0;
uint32_t livePeriodMs = 100, lastLiveMs = 0;
uint8_t runtimeMode = MODE_IDLE;
uint32_t sequenceNumber = 0, runId = 0;
char commandBuffer[96];
uint8_t commandLength = 0;

const uint8_t PHOTO_QUEUE_SIZE = 16;
volatile uint32_t photoTimes[PHOTO_QUEUE_SIZE];
volatile uint8_t photoHead = 0, photoTail = 0;
volatile uint32_t photoEventCount = 0, photoDroppedEvents = 0;

void onPhotoEdge() {
  const uint32_t t = micros();
  photoEventCount++;
  const uint8_t next = (uint8_t)((photoHead + 1U) % PHOTO_QUEUE_SIZE);
  if (next == photoTail) {
    photoDroppedEvents++;
    return;
  }
  photoTimes[photoHead] = t;
  photoHead = next;
}

bool popPhotoEvent(uint32_t &t) {
  noInterrupts();
  if (photoTail == photoHead) { interrupts(); return false; }
  t = photoTimes[photoTail];
  photoTail = (uint8_t)((photoTail + 1U) % PHOTO_QUEUE_SIZE);
  interrupts();
  return true;
}

void snapshotPhoto(uint32_t &count, uint32_t &dropped) {
  noInterrupts(); count = photoEventCount; dropped = photoDroppedEvents; interrupts();
}

float reduceSineArgument(float x) {
  const float pi = PI, twoPi = 2.0f * pi, halfPi = 0.5f * pi;
  float y = fmodf(x + pi, twoPi);
  if (y < 0.0f) y += twoPi;
  y -= pi;
  if (y > halfPi) y = pi - y;
  else if (y < -halfPi) y = -pi - y;
  return y;
}

TaylorResult evaluateTaylor(float x, uint8_t method) {
  TaylorResult out;
  const float y = method == METHOD_REDUCED ? reduceSineArgument(x) : x;
  float term = y, total = y, sumAbs = fabsf(y);
  out.reducedX = y; out.termsUsed = 1; out.stoppingMet = (y == 0.0f); out.finite = isfinite(y);
  if (out.finite && !out.stoppingMet) {
    for (uint16_t n = 1; n < maxTerms; ++n) {
      const float denominator = (float)((2UL*n) * (2UL*n + 1UL));
      term = term * (-y * y) / denominator;
      total += term; sumAbs += fabsf(term); out.termsUsed = n + 1;
      if (!isfinite(term) || !isfinite(total) || !isfinite(sumAbs)) { out.finite = false; break; }
      const float threshold = toleranceMultiplier * FLT_EPSILON * (1.0f + fabsf(total));
      if (fabsf(term) <= threshold) { out.stoppingMet = true; break; }
    }
  }
  out.approximation = out.finite ? total : NAN;
  out.lastTerm = out.finite ? term : NAN;
  out.cancellationRatio = out.finite ? sumAbs / max(fabsf(total), FLT_MIN) : INFINITY;
  return out;
}

float potToX(int raw) {
  return rangeMin + ((float)raw / 1023.0f) * (rangeMax - rangeMin);
}

void emitSchema() {
  Serial.println(F("#SCHEMA,numeric-error-arduino-interactive-v2"));
  Serial.println(F("#COLUMNS,seq,run_id,source_id,method_id,time_us,trigger_time_us,trigger_lag_us,x,reduced_x,approximation,library_sin,terms_used,last_term,cancellation_ratio,stopping_met,finite,elapsed_us,adc_raw,pot_norm,pir_state,switch_state,photo_event_count,photo_dropped_events"));
  Serial.println(F("#BOUNDARY,library_sin is MCU-local evidence only; host mpmath is oracle"));
}

void emitStatus() {
  Serial.print(F("#STATUS,method=")); Serial.print(selectedMethod == METHOD_RAW ? F("RAW") : F("REDUCED"));
  Serial.print(F(",terms=")); Serial.print(maxTerms);
  Serial.print(F(",tol_mult=")); Serial.print(toleranceMultiplier, 4);
  Serial.print(F(",x=")); Serial.print(currentX, 9);
  Serial.print(F(",range_min=")); Serial.print(rangeMin, 9);
  Serial.print(F(",range_max=")); Serial.print(rangeMax, 9);
  Serial.print(F(",points=")); Serial.print(sweepPoints);
  Serial.print(F(",period_ms=")); Serial.print(livePeriodMs);
  Serial.print(F(",mode=")); Serial.println(runtimeMode);
}

void emitHelp() {
  Serial.println(F("#HELP,HELP|STATUS|SCHEMA|METHOD RAW|REDUCED|TERMS n|TOL n|X n|RANGE a b|POINTS n|PERIOD ms|RUN SINGLE|BOTH|SWEEP|LIVE|PHOTO|STOP"));
}

void emitMeasurement(float x, uint8_t sourceId, uint8_t methodId, uint32_t triggerTimeUs) {
  const int adcRaw = analogRead(POT_PIN);
  const float potNorm = (float)adcRaw / 1023.0f;
  const int pirState = digitalRead(PIR_PIN), switchState = digitalRead(SWITCH_PIN);
  uint32_t photoCount, dropped; snapshotPhoto(photoCount, dropped);

  const uint32_t started = micros();
  const TaylorResult r = evaluateTaylor(x, methodId);
  const float librarySin = sinf(x);
  const uint32_t elapsedUs = micros() - started;
  const uint32_t emittedAt = micros();
  const uint32_t triggerLagUs = triggerTimeUs ? (uint32_t)(emittedAt - triggerTimeUs) : 0UL;
  sequenceNumber++;

  Serial.print(sequenceNumber); Serial.print(','); Serial.print(runId); Serial.print(',');
  Serial.print(sourceId); Serial.print(','); Serial.print(methodId); Serial.print(',');
  Serial.print(emittedAt); Serial.print(','); Serial.print(triggerTimeUs); Serial.print(',');
  Serial.print(triggerLagUs); Serial.print(','); Serial.print(x, 9); Serial.print(',');
  Serial.print(r.reducedX, 9); Serial.print(','); Serial.print(r.approximation, 9); Serial.print(',');
  Serial.print(librarySin, 9); Serial.print(','); Serial.print(r.termsUsed); Serial.print(',');
  Serial.print(r.lastTerm, 10); Serial.print(','); Serial.print(r.cancellationRatio, 7); Serial.print(',');
  Serial.print(r.stoppingMet ? 1 : 0); Serial.print(','); Serial.print(r.finite ? 1 : 0); Serial.print(',');
  Serial.print(elapsedUs); Serial.print(','); Serial.print(adcRaw); Serial.print(',');
  Serial.print(potNorm, 7); Serial.print(','); Serial.print(pirState); Serial.print(',');
  Serial.print(switchState); Serial.print(','); Serial.print(photoCount); Serial.print(','); Serial.println(dropped);
  analogWrite(LED_PIN, (uint8_t)(potNorm * 255.0f + 0.5f));
}

void endRun() {
  if (runtimeMode != MODE_IDLE) {
    runtimeMode = MODE_IDLE;
    Serial.print(F("#RUN_END,id=")); Serial.println(runId);
  }
  analogWrite(LED_PIN, 0);
}

void runSingle(bool both) {
  endRun(); runId++;
  Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.println(F(",type=single"));
  if (both) {
    emitMeasurement(currentX, SOURCE_SERIAL, METHOD_RAW, 0);
    emitMeasurement(currentX, SOURCE_SERIAL, METHOD_REDUCED, 0);
  } else emitMeasurement(currentX, SOURCE_SERIAL, selectedMethod, 0);
  Serial.print(F("#RUN_END,id=")); Serial.println(runId);
}

void startSweep() {
  endRun(); runId++; sweepIndex = 0; runtimeMode = MODE_SWEEP;
  Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.print(F(",type=sweep,points=")); Serial.println(sweepPoints);
}
void startLive() { endRun(); runId++; runtimeMode = MODE_LIVE; lastLiveMs = millis() - livePeriodMs; Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.println(F(",type=live_pot")); }
void startPhoto() { endRun(); runId++; runtimeMode = MODE_PHOTO; Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.println(F(",type=photogate_triggered")); }

bool parseFloatToken(const char* token, float &value) {
  if (!token) return false; char* endPtr = nullptr; const double parsed = strtod(token, &endPtr);
  if (endPtr == token || *endPtr != '\0' || !isfinite(parsed)) return false; value = (float)parsed; return true;
}
long parseLongToken(const char* token, bool &ok) {
  ok = false; if (!token) return 0; char* endPtr = nullptr; const long v = strtol(token, &endPtr, 10);
  if (endPtr != token && *endPtr == '\0') ok = true; return v;
}

void handleCommand(char* line) {
  char* command = strtok(line, " \t"); if (!command) return;
  for (char* p=command; *p; ++p) *p=toupper(*p);
  if (!strcmp(command,"HELP")) { emitHelp(); return; }
  if (!strcmp(command,"STATUS")) { emitStatus(); return; }
  if (!strcmp(command,"SCHEMA")) { emitSchema(); return; }
  if (!strcmp(command,"STOP")) { endRun(); return; }
  if (!strcmp(command,"METHOD")) {
    char* a=strtok(nullptr," \t"); if (!a) { Serial.println(F("#ERROR,METHOD")); return; }
    for(char*p=a;*p;++p)*p=toupper(*p);
    if(!strcmp(a,"RAW")) selectedMethod=METHOD_RAW; else if(!strcmp(a,"REDUCED")) selectedMethod=METHOD_REDUCED; else { Serial.println(F("#ERROR,METHOD")); return; }
    emitStatus(); return;
  }
  if (!strcmp(command,"TERMS")) { bool ok; long v=parseLongToken(strtok(nullptr," \t"),ok); if(!ok||v<1||v>160){Serial.println(F("#ERROR,TERMS 1..160"));return;} maxTerms=(uint16_t)v; emitStatus(); return; }
  if (!strcmp(command,"TOL")) { float v; if(!parseFloatToken(strtok(nullptr," \t"),v)||v<=0||v>10000){Serial.println(F("#ERROR,TOL"));return;} toleranceMultiplier=v; emitStatus(); return; }
  if (!strcmp(command,"X")) { float v; if(!parseFloatToken(strtok(nullptr," \t"),v)){Serial.println(F("#ERROR,X"));return;} currentX=v; emitStatus(); return; }
  if (!strcmp(command,"RANGE")) { float a,b; if(!parseFloatToken(strtok(nullptr," \t"),a)||!parseFloatToken(strtok(nullptr," \t"),b)||!(a<b)){Serial.println(F("#ERROR,RANGE"));return;} rangeMin=a;rangeMax=b;emitStatus();return; }
  if (!strcmp(command,"POINTS")) { bool ok; long v=parseLongToken(strtok(nullptr," \t"),ok); if(!ok||v<2||v>500){Serial.println(F("#ERROR,POINTS 2..500"));return;} sweepPoints=(uint16_t)v;emitStatus();return; }
  if (!strcmp(command,"PERIOD")) { bool ok; long v=parseLongToken(strtok(nullptr," \t"),ok); if(!ok||v<20||v>5000){Serial.println(F("#ERROR,PERIOD 20..5000"));return;} livePeriodMs=(uint32_t)v;emitStatus();return; }
  if (!strcmp(command,"RUN")) {
    char*a=strtok(nullptr," \t"); if(!a){Serial.println(F("#ERROR,RUN"));return;} for(char*p=a;*p;++p)*p=toupper(*p);
    if(!strcmp(a,"SINGLE"))runSingle(false); else if(!strcmp(a,"BOTH"))runSingle(true); else if(!strcmp(a,"SWEEP"))startSweep(); else if(!strcmp(a,"LIVE"))startLive(); else if(!strcmp(a,"PHOTO"))startPhoto(); else Serial.println(F("#ERROR,RUN")); return;
  }
  Serial.println(F("#ERROR,unknown command"));
}

void pollSerialCommands() {
  while (Serial.available()) {
    const char c=(char)Serial.read(); if(c=='\r')continue;
    if(c=='\n'){commandBuffer[commandLength]='\0'; if(commandLength)handleCommand(commandBuffer); commandLength=0;}
    else if(commandLength<sizeof(commandBuffer)-1) commandBuffer[commandLength++]=c;
    else {commandLength=0;Serial.println(F("#ERROR,command too long"));}
  }
}

void setup() {
  Serial.begin(BAUD); pinMode(POT_PIN,INPUT); pinMode(PHOTO_PIN,INPUT_PULLUP); pinMode(PIR_PIN,INPUT); pinMode(SWITCH_PIN,INPUT_PULLUP); pinMode(LED_PIN,OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN),onPhotoEdge,FALLING); delay(400);
  Serial.println(F("#READY,BetterBoard_NumericError_InteractiveStudio_v2"));
  Serial.print(F("#MCU,float_bytes="));Serial.print(sizeof(float));Serial.print(F(",double_bytes="));Serial.print(sizeof(double));Serial.print(F(",float_epsilon="));Serial.println(FLT_EPSILON,10);
  emitSchema(); emitStatus();
}

void loop() {
  pollSerialCommands();
  if(runtimeMode==MODE_SWEEP){
    if(sweepIndex>=sweepPoints){ Serial.print(F("#RUN_END,id="));Serial.println(runId);runtimeMode=MODE_IDLE; }
    else { const float fraction=(float)sweepIndex/(float)(sweepPoints-1); const float x=rangeMin+fraction*(rangeMax-rangeMin); sweepIndex++; emitMeasurement(x,SOURCE_SWEEP,selectedMethod,0); }
  } else if(runtimeMode==MODE_LIVE){
    const uint32_t now=millis(); if((uint32_t)(now-lastLiveMs)>=livePeriodMs){lastLiveMs=now; const int raw=analogRead(POT_PIN);currentX=potToX(raw);emitMeasurement(currentX,SOURCE_LIVE,selectedMethod,0);}
  } else if(runtimeMode==MODE_PHOTO){
    uint32_t trigger; if(popPhotoEvent(trigger)){ const int raw=analogRead(POT_PIN); currentX=potToX(raw); emitMeasurement(currentX,SOURCE_PHOTO,selectedMethod,trigger); }
  }
}
