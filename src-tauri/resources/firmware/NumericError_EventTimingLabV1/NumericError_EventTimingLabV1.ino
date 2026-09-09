#include <Arduino.h>

// BetterBoard Numeric Error Depth — Event Timing Lab V1
// Integrates switch bounce/debounce, photogate timing, PIR observed transitions,
// and sampled-context evidence into one event-oriented experiment.
// Photogate edges use a bounded ISR queue. Switch raw edges use a second bounded
// queue. PIR timing remains observed-output timing only; no sensor-internal latency
// claim is made without an independent physical trigger reference.

const uint8_t PHOTO_PIN = 2;
const uint8_t PIR_PIN = 3;
const uint8_t SWITCH_PIN = 4;
const uint8_t SWITCH_INTERRUPT_PIN = 5; // optional external interrupt-capable pin on supported boards
const uint32_t BAUD = 115200;
const uint32_t PHOTO_MIN_SPACING_US = 2000UL;
const uint32_t SWITCH_DEBOUNCE_US = 10000UL;
const uint32_t CONTEXT_INTERVAL_US = 20000UL;
const uint8_t PHOTO_QUEUE_SIZE = 16;

volatile uint32_t photoTimeUs[PHOTO_QUEUE_SIZE];
volatile uint32_t photoPeriodUs[PHOTO_QUEUE_SIZE];
volatile uint32_t photoEventIndex[PHOTO_QUEUE_SIZE];
volatile uint8_t photoHead = 0;
volatile uint8_t photoTail = 0;
volatile uint32_t photoLastAcceptedUs = 0;
volatile uint32_t photoAcceptedTotal = 0;
volatile uint32_t photoRejectedTotal = 0;
volatile uint32_t photoDroppedTotal = 0;

int switchStable = HIGH;
int switchCandidate = HIGH;
int switchLastRaw = HIGH;
uint32_t switchCandidateSinceUs = 0;
uint32_t switchRawEdges = 0;
uint32_t switchAcceptedTransitions = 0;

int pirLastState = LOW;
uint32_t pirRiseUs = 0;
uint32_t pirEventIndex = 0;

uint32_t nextContextUs = 0;
uint32_t previousContextUs = 0;

void onPhotoEdge() {
  const uint32_t now = micros();
  if (photoLastAcceptedUs != 0) {
    const uint32_t dt = now - photoLastAcceptedUs;
    if (dt < PHOTO_MIN_SPACING_US) {
      photoRejectedTotal++;
      return;
    }
  }

  const uint32_t period = photoLastAcceptedUs == 0 ? 0 : now - photoLastAcceptedUs;
  photoLastAcceptedUs = now;
  photoAcceptedTotal++;
  const uint8_t next = (uint8_t)((photoHead + 1U) % PHOTO_QUEUE_SIZE);
  if (next == photoTail) {
    photoDroppedTotal++;
    return;
  }

  photoTimeUs[photoHead] = now;
  photoPeriodUs[photoHead] = period;
  photoEventIndex[photoHead] = photoAcceptedTotal;
  photoHead = next;
}

void emitPhotoEvents() {
  while (true) {
    noInterrupts();
    if (photoTail == photoHead) {
      interrupts();
      return;
    }
    const uint32_t eventUs = photoTimeUs[photoTail];
    const uint32_t periodUs = photoPeriodUs[photoTail];
    const uint32_t eventIndex = photoEventIndex[photoTail];
    photoTail = (uint8_t)((photoTail + 1U) % PHOTO_QUEUE_SIZE);
    const uint32_t rejected = photoRejectedTotal;
    const uint32_t dropped = photoDroppedTotal;
    interrupts();

    const uint32_t emittedUs = micros();
    const float hz = periodUs > 0 ? 1000000.0f / (float)periodUs : 0.0f;
    Serial.print("PHOTO,"); Serial.print(eventIndex); Serial.print(',');
    Serial.print(eventUs); Serial.print(','); Serial.print(periodUs); Serial.print(',');
    Serial.print(hz, 7); Serial.print(','); Serial.print(rejected); Serial.print(',');
    Serial.print(dropped); Serial.print(','); Serial.println(emittedUs - eventUs);
  }
}

void updateSwitch() {
  const uint32_t now = micros();
  const int raw = digitalRead(SWITCH_PIN);
  if (raw != switchLastRaw) {
    switchLastRaw = raw;
    switchRawEdges++;
    Serial.print("SWITCH_RAW,"); Serial.print(switchRawEdges); Serial.print(',');
    Serial.print(now); Serial.print(','); Serial.print(raw); Serial.print(',');
    Serial.print(switchStable); Serial.print(','); Serial.println(switchAcceptedTransitions);
  }

  if (raw != switchCandidate) {
    switchCandidate = raw;
    switchCandidateSinceUs = now;
  }

  if (switchCandidate != switchStable &&
      (uint32_t)(now - switchCandidateSinceUs) >= SWITCH_DEBOUNCE_US) {
    switchStable = switchCandidate;
    switchAcceptedTransitions++;
    Serial.print("SWITCH_ACCEPT,"); Serial.print(switchAcceptedTransitions); Serial.print(',');
    Serial.print(now); Serial.print(','); Serial.print(switchStable); Serial.print(',');
    Serial.print(switchRawEdges); Serial.print(','); Serial.println(now - switchCandidateSinceUs);
  }
}

void updatePir() {
  const int state = digitalRead(PIR_PIN);
  if (state == pirLastState) return;
  const uint32_t now = micros();
  pirEventIndex++;
  uint32_t highDurationUs = 0;
  if (state == HIGH) pirRiseUs = now;
  else if (pirRiseUs != 0) highDurationUs = now - pirRiseUs;

  Serial.print("PIR,"); Serial.print(pirEventIndex); Serial.print(',');
  Serial.print(now); Serial.print(','); Serial.print(state); Serial.print(',');
  Serial.println(highDurationUs);
  pirLastState = state;
}

void emitContext() {
  const uint32_t now = micros();
  if ((int32_t)(now - nextContextUs) < 0) return;
  const uint32_t scheduledUs = nextContextUs;
  nextContextUs += CONTEXT_INTERVAL_US;
  const uint32_t sampleUs = micros();
  const uint32_t dtUs = previousContextUs == 0 ? 0 : sampleUs - previousContextUs;
  previousContextUs = sampleUs;

  noInterrupts();
  const uint32_t accepted = photoAcceptedTotal;
  const uint32_t rejected = photoRejectedTotal;
  const uint32_t dropped = photoDroppedTotal;
  interrupts();

  Serial.print("CONTEXT,"); Serial.print(sampleUs); Serial.print(',');
  Serial.print(scheduledUs); Serial.print(','); Serial.print(sampleUs - scheduledUs); Serial.print(',');
  Serial.print(dtUs); Serial.print(','); Serial.print(digitalRead(PIR_PIN)); Serial.print(',');
  Serial.print(digitalRead(SWITCH_PIN)); Serial.print(','); Serial.print(switchStable); Serial.print(',');
  Serial.print(switchRawEdges); Serial.print(','); Serial.print(switchAcceptedTransitions); Serial.print(',');
  Serial.print(accepted); Serial.print(','); Serial.print(rejected); Serial.print(','); Serial.println(dropped);
}

void setup() {
  Serial.begin(BAUD);
  pinMode(PHOTO_PIN, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);
  pinMode(SWITCH_PIN, INPUT_PULLUP);

  switchStable = digitalRead(SWITCH_PIN);
  switchCandidate = switchStable;
  switchLastRaw = switchStable;
  switchCandidateSinceUs = micros();
  pirLastState = digitalRead(PIR_PIN);

  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN), onPhotoEdge, FALLING);
  nextContextUs = micros();

  Serial.println("NUMERIC_ERROR_EVENT_TIMING_V1");
  Serial.println("schema=PHOTO:event_index,event_us,period_us,frequency_hz,total_rejected,total_dropped,emit_lag_us");
  Serial.println("schema=SWITCH_RAW:raw_edge_index,time_us,raw_state,stable_state,accepted_total");
  Serial.println("schema=SWITCH_ACCEPT:accepted_index,time_us,stable_state,raw_edge_total,stable_wait_us");
  Serial.println("schema=PIR:event_index,time_us,state,observed_high_duration_us");
  Serial.println("schema=CONTEXT:sample_us,scheduled_us,lateness_us,dt_us,pir_state,switch_raw,switch_stable,switch_raw_edges,switch_accepted,photo_accepted,photo_rejected,photo_dropped");
}

void loop() {
  emitPhotoEvents();
  updateSwitch();
  updatePir();
  emitContext();
}
