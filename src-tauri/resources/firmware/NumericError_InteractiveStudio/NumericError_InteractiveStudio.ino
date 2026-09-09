#include <Arduino.h>
#include <math.h>
#include <float.h>
#include <string.h>

// BetterBoard / Physical Lab Numeric Error Interactive Studio
// Target: Arduino UNO-class AVR board
// Hardware mapping:
//   A0  potentiometer (optional live x input)
//   D2  photogate / optical pulse input (optional event trigger)
//   D3  PIR digital input (context channel)
//   D4  push switch with INPUT_PULLUP (context / manual marker)
//   D9  LED PWM output (activity / live-position indicator)
//
// Design principle:
//   The MCU reports what it can know locally. It does NOT pretend its own sinf()
//   result is an independent truth oracle. A host bridge should compute the
//   high-precision reference and final error/reliability classification.
//
// Serial protocol: 115200 baud, newline-terminated ASCII commands.
// Human/control lines begin with '#'. Measurement rows are numeric-only CSV,
// so BetterBoard / Physical Lab numeric capture can ignore control text and
// preserve the evidence rows without ambiguity.

const uint32_t BAUD = 115200;
const uint8_t POT_PIN = A0;
const uint8_t PHOTO_PIN = 2;
const uint8_t PIR_PIN = 3;
const uint8_t SWITCH_PIN = 4;
const uint8_t LED_PIN = 9;

const uint8_t METHOD_RAW = 0;
const uint8_t METHOD_RANGE_REDUCED = 1;

const uint8_t SOURCE_SERIAL_SINGLE = 0;
const uint8_t SOURCE_SWEEP = 1;
const uint8_t SOURCE_LIVE_POT = 2;
const uint8_t SOURCE_PHOTOGATE = 3;

const uint8_t MODE_IDLE = 0;
const uint8_t MODE_LIVE = 1;
const uint8_t MODE_PHOTO = 2;

struct TaylorResult {
  float reducedX;
  float approximation;
  float lastTerm;
  float cancellationRatio;
  uint16_t termsUsed;
  bool stoppingMet;
  bool finite;
};

uint8_t selectedMethod = METHOD_RANGE_REDUCED;
uint16_t maxTerms = 80;
float toleranceMultiplier = 8.0f;
float currentX = 1.57079632679f;
float rangeMin = -3.14159265f;
float rangeMax = 3.14159265f;
uint16_t sweepPoints = 101;
uint32_t livePeriodMs = 100;
uint8_t runtimeMode = MODE_IDLE;

uint32_t sequenceNumber = 0;
uint32_t runId = 0;
uint32_t lastLiveMs = 0;

volatile uint32_t photoEventCount = 0;
volatile uint32_t lastPhotoEventUs = 0;
volatile bool photoEventPending = false;

char commandBuffer[96];
uint8_t commandLength = 0;

float reduceSineArgument(float x) {
  const float pi = PI;
  const float twoPi = 2.0f * pi;
  float y = fmodf(x + pi, twoPi);
  if (y < 0.0f) y += twoPi;
  y -= pi;
  const float halfPi = 0.5f * pi;
  if (y > halfPi) y = pi - y;
  else if (y < -halfPi) y = -pi - y;
  return y;
}

TaylorResult evaluateTaylor(float x, uint8_t method) {
  TaylorResult out;
  const float y = (method == METHOD_RANGE_REDUCED) ? reduceSineArgument(x) : x;
  out.reducedX = y;
  out.approximation = y;
  out.lastTerm = y;
  out.termsUsed = 1;
  out.stoppingMet = (y == 0.0f);
  out.finite = isfinite(y);

  float term = y;
  float total = y;
  float sumAbsTerms = fabsf(term);

  if (out.finite && !out.stoppingMet) {
    for (uint16_t n = 1; n < maxTerms; ++n) {
      const float denominator = (float)((2UL * n) * (2UL * n + 1UL));
      term = term * (-y * y) / denominator;
      total += term;
      sumAbsTerms += fabsf(term);
      out.termsUsed = n + 1;

      if (!isfinite(term) || !isfinite(total) || !isfinite(sumAbsTerms)) {
        out.finite = false;
        break;
      }

      const float threshold = toleranceMultiplier * FLT_EPSILON * (1.0f + fabsf(total));
      if (fabsf(term) <= threshold) {
        out.stoppingMet = true;
        break;
      }
    }
  }

  out.approximation = out.finite ? total : NAN;
  out.lastTerm = out.finite ? term : NAN;
  const float denominator = max(fabsf(total), FLT_MIN);
  out.cancellationRatio = out.finite ? (sumAbsTerms / denominator) : INFINITY;
  return out;
}

void onPhotoEdge() {
  lastPhotoEventUs = micros();
  photoEventCount++;
  photoEventPending = true;
}

float potToX(int raw) {
  const float normalized = (float)raw / 1023.0f;
  return rangeMin + normalized * (rangeMax - rangeMin);
}

void emitSchema() {
  Serial.println(F("#SCHEMA,numeric-error-arduino-interactive-v1"));
  Serial.println(F("#COLUMNS,seq,run_id,source_id,method_id,time_us,x,reduced_x,approximation,library_sin,terms_used,last_term,cancellation_ratio,stopping_met,finite,elapsed_us,adc_raw,pot_norm,pir_state,switch_state,photo_event_count"));
  Serial.println(F("#SOURCE_ID,0=serial_single,1=sweep,2=live_pot,3=photogate"));
  Serial.println(F("#METHOD_ID,0=raw_taylor,1=range_reduced_taylor"));
  Serial.println(F("#BOUNDARY,library_sin is MCU-local comparison evidence, not an independent high-precision oracle"));
}

void emitStatus() {
  Serial.print(F("#STATUS,method=")); Serial.print(selectedMethod == METHOD_RAW ? F("RAW") : F("REDUCED"));
  Serial.print(F(",terms=")); Serial.print(maxTerms);
  Serial.print(F(",tol_mult=")); Serial.print(toleranceMultiplier, 4);
  Serial.print(F(",x=")); Serial.print(currentX, 8);
  Serial.print(F(",range_min=")); Serial.print(rangeMin, 8);
  Serial.print(F(",range_max=")); Serial.print(rangeMax, 8);
  Serial.print(F(",points=")); Serial.print(sweepPoints);
  Serial.print(F(",period_ms=")); Serial.print(livePeriodMs);
  Serial.print(F(",mode=")); Serial.println(runtimeMode);
}

void emitHelp() {
  Serial.println(F("#HELP,commands:"));
  Serial.println(F("#  HELP"));
  Serial.println(F("#  STATUS"));
  Serial.println(F("#  SCHEMA"));
  Serial.println(F("#  METHOD RAW|REDUCED"));
  Serial.println(F("#  TERMS <1..160>"));
  Serial.println(F("#  TOL <positive multiplier>"));
  Serial.println(F("#  X <radians>"));
  Serial.println(F("#  RANGE <min_rad> <max_rad>"));
  Serial.println(F("#  POINTS <2..500>"));
  Serial.println(F("#  PERIOD <20..5000_ms>"));
  Serial.println(F("#  RUN SINGLE"));
  Serial.println(F("#  RUN BOTH"));
  Serial.println(F("#  RUN SWEEP"));
  Serial.println(F("#  RUN LIVE"));
  Serial.println(F("#  RUN PHOTO"));
  Serial.println(F("#  STOP"));
}

void emitMeasurement(float x, uint8_t sourceId, uint8_t methodId) {
  const int adcRaw = analogRead(POT_PIN);
  const float potNorm = (float)adcRaw / 1023.0f;
  const int pirState = digitalRead(PIR_PIN);
  const int switchState = digitalRead(SWITCH_PIN);

  noInterrupts();
  const uint32_t photoCount = photoEventCount;
  interrupts();

  const uint32_t started = micros();
  const TaylorResult r = evaluateTaylor(x, methodId);
  const float librarySin = sinf(x);
  const uint32_t elapsedUs = micros() - started;

  sequenceNumber++;

  Serial.print(sequenceNumber); Serial.print(',');
  Serial.print(runId); Serial.print(',');
  Serial.print(sourceId); Serial.print(',');
  Serial.print(methodId); Serial.print(',');
  Serial.print(micros()); Serial.print(',');
  Serial.print(x, 9); Serial.print(',');
  Serial.print(r.reducedX, 9); Serial.print(',');
  Serial.print(r.approximation, 9); Serial.print(',');
  Serial.print(librarySin, 9); Serial.print(',');
  Serial.print(r.termsUsed); Serial.print(',');
  Serial.print(r.lastTerm, 10); Serial.print(',');
  Serial.print(r.cancellationRatio, 7); Serial.print(',');
  Serial.print(r.stoppingMet ? 1 : 0); Serial.print(',');
  Serial.print(r.finite ? 1 : 0); Serial.print(',');
  Serial.print(elapsedUs); Serial.print(',');
  Serial.print(adcRaw); Serial.print(',');
  Serial.print(potNorm, 7); Serial.print(',');
  Serial.print(pirState); Serial.print(',');
  Serial.print(switchState); Serial.print(',');
  Serial.println(photoCount);

  analogWrite(LED_PIN, (uint8_t)(potNorm * 255.0f + 0.5f));
}

void runSingle(bool bothMethods) {
  runtimeMode = MODE_IDLE;
  runId++;
  Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.println(F(",type=single"));
  if (bothMethods) {
    emitMeasurement(currentX, SOURCE_SERIAL_SINGLE, METHOD_RAW);
    emitMeasurement(currentX, SOURCE_SERIAL_SINGLE, METHOD_RANGE_REDUCED);
  } else {
    emitMeasurement(currentX, SOURCE_SERIAL_SINGLE, selectedMethod);
  }
  Serial.print(F("#RUN_END,id=")); Serial.println(runId);
}

void runSweep() {
  runtimeMode = MODE_IDLE;
  runId++;
  Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.print(F(",type=sweep,points=")); Serial.println(sweepPoints);

  for (uint16_t i = 0; i < sweepPoints; ++i) {
    const float fraction = (sweepPoints <= 1) ? 0.0f : (float)i / (float)(sweepPoints - 1);
    const float x = rangeMin + fraction * (rangeMax - rangeMin);
    emitMeasurement(x, SOURCE_SWEEP, selectedMethod);
    if (Serial.available()) {
      Serial.println(F("#NOTICE,input_waiting_during_sweep; sweep continues deterministically"));
    }
  }

  Serial.print(F("#RUN_END,id=")); Serial.println(runId);
}

void startLive() {
  runId++;
  runtimeMode = MODE_LIVE;
  lastLiveMs = 0;
  Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.println(F(",type=live_pot"));
}

void startPhoto() {
  runId++;
  runtimeMode = MODE_PHOTO;
  Serial.print(F("#RUN_START,id=")); Serial.print(runId); Serial.println(F(",type=photogate_triggered"));
}

void stopRuntime() {
  if (runtimeMode != MODE_IDLE) {
    runtimeMode = MODE_IDLE;
    Serial.print(F("#RUN_END,id=")); Serial.println(runId);
  } else {
    Serial.println(F("#STATUS,already_idle"));
  }
  analogWrite(LED_PIN, 0);
}

bool parseFloatToken(const char* token, float& value) {
  if (!token) return false;
  char* endPtr = nullptr;
  const double parsed = strtod(token, &endPtr);
  if (endPtr == token || *endPtr != '\0' || !isfinite(parsed)) return false;
  value = (float)parsed;
  return true;
}

long parseLongToken(const char* token, bool& ok) {
  ok = false;
  if (!token) return 0;
  char* endPtr = nullptr;
  const long value = strtol(token, &endPtr, 10);
  if (endPtr != token && *endPtr == '\0') ok = true;
  return value;
}

void handleCommand(char* line) {
  char* command = strtok(line, " \t");
  if (!command) return;

  for (char* p = command; *p; ++p) *p = toupper(*p);

  if (!strcmp(command, "HELP")) { emitHelp(); return; }
  if (!strcmp(command, "STATUS")) { emitStatus(); return; }
  if (!strcmp(command, "SCHEMA")) { emitSchema(); return; }
  if (!strcmp(command, "STOP")) { stopRuntime(); return; }

  if (!strcmp(command, "METHOD")) {
    char* arg = strtok(nullptr, " \t");
    if (!arg) { Serial.println(F("#ERROR,METHOD requires RAW or REDUCED")); return; }
    for (char* p = arg; *p; ++p) *p = toupper(*p);
    if (!strcmp(arg, "RAW")) selectedMethod = METHOD_RAW;
    else if (!strcmp(arg, "REDUCED")) selectedMethod = METHOD_RANGE_REDUCED;
    else { Serial.println(F("#ERROR,unknown METHOD")); return; }
    emitStatus(); return;
  }

  if (!strcmp(command, "TERMS")) {
    bool ok = false; const long v = parseLongToken(strtok(nullptr, " \t"), ok);
    if (!ok || v < 1 || v > 160) { Serial.println(F("#ERROR,TERMS must be 1..160")); return; }
    maxTerms = (uint16_t)v; emitStatus(); return;
  }

  if (!strcmp(command, "TOL")) {
    float v; if (!parseFloatToken(strtok(nullptr, " \t"), v) || v <= 0.0f || v > 10000.0f) { Serial.println(F("#ERROR,TOL must be positive and <=10000")); return; }
    toleranceMultiplier = v; emitStatus(); return;
  }

  if (!strcmp(command, "X")) {
    float v; if (!parseFloatToken(strtok(nullptr, " \t"), v)) { Serial.println(F("#ERROR,X requires a finite number")); return; }
    currentX = v; emitStatus(); return;
  }

  if (!strcmp(command, "RANGE")) {
    float a, b;
    if (!parseFloatToken(strtok(nullptr, " \t"), a) || !parseFloatToken(strtok(nullptr, " \t"), b) || !(a < b)) {
      Serial.println(F("#ERROR,RANGE requires finite min < max")); return;
    }
    rangeMin = a; rangeMax = b; emitStatus(); return;
  }

  if (!strcmp(command, "POINTS")) {
    bool ok = false; const long v = parseLongToken(strtok(nullptr, " \t"), ok);
    if (!ok || v < 2 || v > 500) { Serial.println(F("#ERROR,POINTS must be 2..500")); return; }
    sweepPoints = (uint16_t)v; emitStatus(); return;
  }

  if (!strcmp(command, "PERIOD")) {
    bool ok = false; const long v = parseLongToken(strtok(nullptr, " \t"), ok);
    if (!ok || v < 20 || v > 5000) { Serial.println(F("#ERROR,PERIOD must be 20..5000 ms")); return; }
    livePeriodMs = (uint32_t)v; emitStatus(); return;
  }

  if (!strcmp(command, "RUN")) {
    char* arg = strtok(nullptr, " \t");
    if (!arg) { Serial.println(F("#ERROR,RUN requires SINGLE|BOTH|SWEEP|LIVE|PHOTO")); return; }
    for (char* p = arg; *p; ++p) *p = toupper(*p);
    if (!strcmp(arg, "SINGLE")) runSingle(false);
    else if (!strcmp(arg, "BOTH")) runSingle(true);
    else if (!strcmp(arg, "SWEEP")) runSweep();
    else if (!strcmp(arg, "LIVE")) startLive();
    else if (!strcmp(arg, "PHOTO")) startPhoto();
    else Serial.println(F("#ERROR,unknown RUN mode"));
    return;
  }

  Serial.println(F("#ERROR,unknown command; send HELP"));
}

void pollSerialCommands() {
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      commandBuffer[commandLength] = '\0';
      if (commandLength > 0) handleCommand(commandBuffer);
      commandLength = 0;
    } else if (commandLength < sizeof(commandBuffer) - 1) {
      commandBuffer[commandLength++] = c;
    } else {
      commandLength = 0;
      Serial.println(F("#ERROR,command too long"));
    }
  }
}

void setup() {
  Serial.begin(BAUD);
  pinMode(POT_PIN, INPUT);
  pinMode(PHOTO_PIN, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN), onPhotoEdge, FALLING);

  delay(400);
  Serial.println(F("#READY,BetterBoard_NumericError_InteractiveStudio_v1"));
  Serial.print(F("#MCU,float_bytes=")); Serial.print(sizeof(float));
  Serial.print(F(",double_bytes=")); Serial.print(sizeof(double));
  Serial.print(F(",float_epsilon=")); Serial.println(FLT_EPSILON, 10);
  emitSchema();
  emitStatus();
}

void loop() {
  pollSerialCommands();

  if (runtimeMode == MODE_LIVE) {
    const uint32_t nowMs = millis();
    if ((uint32_t)(nowMs - lastLiveMs) >= livePeriodMs) {
      lastLiveMs = nowMs;
      const int raw = analogRead(POT_PIN);
      currentX = potToX(raw);
      emitMeasurement(currentX, SOURCE_LIVE_POT, selectedMethod);
    }
  }

  if (runtimeMode == MODE_PHOTO) {
    noInterrupts();
    const bool pending = photoEventPending;
    if (pending) photoEventPending = false;
    interrupts();

    if (pending) {
      const int raw = analogRead(POT_PIN);
      currentX = potToX(raw);
      emitMeasurement(currentX, SOURCE_PHOTOGATE, selectedMethod);
    }
  }
}
