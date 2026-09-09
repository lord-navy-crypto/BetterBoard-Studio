#include <Arduino.h>

// BetterBoard Numeric Error — Debounce Comparison V2
// D2 switch input with INPUT_PULLUP.
// Preserves individual raw edge timestamps in a bounded ISR ring buffer while
// separately reporting accepted stable transitions. Overflow is counted so
// evidence loss is explicit rather than silent.

const uint8_t SWITCH_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t DEBOUNCE_US = 10000UL;
const uint8_t EDGE_BUFFER_SIZE = 32;

volatile uint32_t edgeTimeUs[EDGE_BUFFER_SIZE];
volatile uint8_t edgeState[EDGE_BUFFER_SIZE];
volatile uint8_t edgeHead = 0;
volatile uint8_t edgeTail = 0;
volatile uint32_t rawEdgeCount = 0;
volatile uint32_t droppedEdgeCount = 0;

int stableState = HIGH;
int candidateState = HIGH;
uint32_t candidateSinceUs = 0;
uint32_t acceptedCount = 0;

void onRawEdge() {
  const uint8_t nextHead = (uint8_t)((edgeHead + 1U) % EDGE_BUFFER_SIZE);
  rawEdgeCount++;

  if (nextHead == edgeTail) {
    droppedEdgeCount++;
    return;
  }

  edgeTimeUs[edgeHead] = micros();
  edgeState[edgeHead] = (uint8_t)digitalRead(SWITCH_PIN);
  edgeHead = nextHead;
}

bool popRawEdge(uint32_t &timeUs, uint8_t &state, uint32_t &rawCount, uint32_t &droppedCount) {
  noInterrupts();
  if (edgeTail == edgeHead) {
    rawCount = rawEdgeCount;
    droppedCount = droppedEdgeCount;
    interrupts();
    return false;
  }

  timeUs = edgeTimeUs[edgeTail];
  state = edgeState[edgeTail];
  edgeTail = (uint8_t)((edgeTail + 1U) % EDGE_BUFFER_SIZE);
  rawCount = rawEdgeCount;
  droppedCount = droppedEdgeCount;
  interrupts();
  return true;
}

void printEvent(uint32_t timeUs, int raw, const char *eventType,
                uint32_t rawCount, uint32_t droppedCount) {
  Serial.print(timeUs); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(stableState); Serial.print(',');
  Serial.print(rawCount); Serial.print(',');
  Serial.print(acceptedCount); Serial.print(',');
  Serial.print(droppedCount); Serial.print(',');
  Serial.println(eventType);
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  stableState = digitalRead(SWITCH_PIN);
  candidateState = stableState;
  candidateSinceUs = micros();
  attachInterrupt(digitalPinToInterrupt(SWITCH_PIN), onRawEdge, CHANGE);

  Serial.println("NUMERIC_ERROR_DEBOUNCE_V2");
  Serial.println("time_us,raw_state,stable_state,raw_edge_count,accepted_count,dropped_edge_count,event_type");
}

void loop() {
  uint32_t edgeUs;
  uint8_t edgeRaw;
  uint32_t rawCount;
  uint32_t droppedCount;

  while (popRawEdge(edgeUs, edgeRaw, rawCount, droppedCount)) {
    printEvent(edgeUs, edgeRaw, "RAW_EDGE", rawCount, droppedCount);
  }

  const uint32_t now = micros();
  const int raw = digitalRead(SWITCH_PIN);

  if (raw != candidateState) {
    candidateState = raw;
    candidateSinceUs = now;
  }

  if (candidateState != stableState &&
      (uint32_t)(now - candidateSinceUs) >= DEBOUNCE_US) {
    stableState = candidateState;
    acceptedCount++;

    noInterrupts();
    rawCount = rawEdgeCount;
    droppedCount = droppedEdgeCount;
    interrupts();

    printEvent(now, raw, "ACCEPTED_STABLE_TRANSITION", rawCount, droppedCount);
  }
}
