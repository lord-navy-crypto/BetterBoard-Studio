#include <Arduino.h>

// BetterBoard Hardware Numeric Error Depth 2 — PIR polling latency
// D3 supports CHANGE interrupt on UNO. Input mode / interrupt mode are compile-
// time configurable because PIR modules differ. The interrupt timestamp is the
// digital edge evidence; polling delay is PROGRAM latency, not physical PIR latency.

#ifndef BB_POLL_INTERVAL_US
#define BB_POLL_INTERVAL_US 2000UL
#endif
#ifndef BB_TIMER_QUANTUM_US
#define BB_TIMER_QUANTUM_US 4UL
#endif
#ifndef BB_PIR_INPUT_MODE
#define BB_PIR_INPUT_MODE INPUT
#endif
#ifndef BB_PIR_INTERRUPT_MODE
#define BB_PIR_INTERRUPT_MODE CHANGE
#endif

const uint8_t PIR_PIN = 3;
const uint32_t POLL_INTERVAL_US = (uint32_t)BB_POLL_INTERVAL_US;
const uint32_t TIMER_QUANTUM_US = (uint32_t)BB_TIMER_QUANTUM_US;

volatile uint32_t latestIsrUs = 0;
volatile uint32_t isrEdgeCount = 0;
volatile uint8_t latestIsrState = LOW;
uint32_t lastPollUs = 0;
uint32_t lastSeenIsrCount = 0;
uint32_t reportIndex = 0;
uint8_t lastPolledState = LOW;

void onPirChange() {
  latestIsrUs = micros();
  latestIsrState = (uint8_t)digitalRead(PIR_PIN);
  isrEdgeCount++;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, BB_PIR_INPUT_MODE);
  lastPolledState = (uint8_t)digitalRead(PIR_PIN);
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), onPirChange, BB_PIR_INTERRUPT_MODE);
  lastPollUs = micros();
  Serial.println("report_index,poll_time_us,pir_state,isr_edge_count,edges_since_last_report,latest_isr_time_us,latest_isr_state,poll_transition,matched_latest_edge,poll_detection_delay_us,poll_interval_us,timer_quantum_us,coalesced_edge_risk");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - lastPollUs) < POLL_INTERVAL_US) return;
  lastPollUs += POLL_INTERVAL_US;
  const uint32_t pollTimeUs = micros();
  const uint8_t state = (uint8_t)digitalRead(PIR_PIN);

  noInterrupts();
  const uint32_t edgeCount = isrEdgeCount;
  const uint32_t edgeUs = latestIsrUs;
  const uint8_t edgeState = latestIsrState;
  interrupts();

  const uint32_t edgesSince = (uint32_t)(edgeCount - lastSeenIsrCount);
  const bool transition = state != lastPolledState;
  if (edgesSince == 0 && !transition) return;

  const bool matched = transition && edgesSince > 0 && edgeState == state;
  const uint32_t detectionDelayUs = matched ? (uint32_t)(pollTimeUs - edgeUs) : 0UL;
  const bool coalescedRisk = edgesSince > 1;

  Serial.print(reportIndex++); Serial.print(',');
  Serial.print(pollTimeUs); Serial.print(',');
  Serial.print(state); Serial.print(',');
  Serial.print(edgeCount); Serial.print(',');
  Serial.print(edgesSince); Serial.print(',');
  Serial.print(edgeUs); Serial.print(',');
  Serial.print(edgeState); Serial.print(',');
  Serial.print(transition ? 1 : 0); Serial.print(',');
  Serial.print(matched ? 1 : 0); Serial.print(',');
  Serial.print(detectionDelayUs); Serial.print(',');
  Serial.print(POLL_INTERVAL_US); Serial.print(',');
  Serial.print(TIMER_QUANTUM_US); Serial.print(',');
  Serial.println(coalescedRisk ? 1 : 0);

  lastSeenIsrCount = edgeCount;
  lastPolledState = state;
}
