#include <Arduino.h>

// BetterBoard Numeric Error — Debounce Comparison
// D2 switch input with INPUT_PULLUP. Compares raw edge stream with a simple
// stable-time debounce rule and reports which physical edges are accepted.

const uint8_t SWITCH_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t DEBOUNCE_US = 10000UL;

volatile uint32_t rawEdgeCount = 0;
volatile uint32_t lastRawEdgeUs = 0;
volatile bool rawChanged = false;

int stableState = HIGH;
int candidateState = HIGH;
uint32_t candidateSinceUs = 0;
uint32_t acceptedCount = 0;

void onRawEdge() {
  lastRawEdgeUs = micros();
  rawEdgeCount++;
  rawChanged = true;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  stableState = digitalRead(SWITCH_PIN);
  candidateState = stableState;
  attachInterrupt(digitalPinToInterrupt(SWITCH_PIN), onRawEdge, CHANGE);
  Serial.println("time_us,raw_state,stable_state,raw_edge_count,accepted_count,event_type");
}

void loop() {
  const uint32_t now = micros();
  const int raw = digitalRead(SWITCH_PIN);

  noInterrupts();
  const bool hadRaw = rawChanged;
  rawChanged = false;
  const uint32_t rawCount = rawEdgeCount;
  interrupts();

  if (raw != candidateState) {
    candidateState = raw;
    candidateSinceUs = now;
  }

  if (candidateState != stableState && (uint32_t)(now - candidateSinceUs) >= DEBOUNCE_US) {
    stableState = candidateState;
    acceptedCount++;
    Serial.print(now); Serial.print(',');
    Serial.print(raw); Serial.print(',');
    Serial.print(stableState); Serial.print(',');
    Serial.print(rawCount); Serial.print(',');
    Serial.print(acceptedCount); Serial.print(',');
    Serial.println("ACCEPTED_STABLE_TRANSITION");
  } else if (hadRaw) {
    Serial.print(now); Serial.print(',');
    Serial.print(raw); Serial.print(',');
    Serial.print(stableState); Serial.print(',');
    Serial.print(rawCount); Serial.print(',');
    Serial.print(acceptedCount); Serial.print(',');
    Serial.println("RAW_EDGE");
  }
}
