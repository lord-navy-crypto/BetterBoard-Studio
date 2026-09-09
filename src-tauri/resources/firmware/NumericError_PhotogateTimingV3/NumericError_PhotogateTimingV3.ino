#include <Arduino.h>

// BetterBoard Numeric Error Depth — Photogate Timing V3
// Consolidates legacy PhotogateTiming V1/V2. Accepted events are queued with
// timestamps; close-edge rejection does not move the accepted baseline; queue
// overflow is explicit evidence rather than silent loss.

const uint8_t SENSOR_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t MIN_ACCEPTED_SPACING_US = 2000UL;
const uint8_t QUEUE_SIZE = 16;

volatile uint32_t eventUsQueue[QUEUE_SIZE];
volatile uint32_t periodUsQueue[QUEUE_SIZE];
volatile uint16_t rejectedQueue[QUEUE_SIZE];
volatile uint8_t head = 0, tail = 0;
volatile uint32_t lastAcceptedUs = 0;
volatile uint32_t acceptedTotal = 0;
volatile uint32_t rejectedTotal = 0;
volatile uint16_t rejectedSinceAccepted = 0;
volatile uint32_t droppedAcceptedEvents = 0;

void onEdge() {
  const uint32_t now = micros();
  if (lastAcceptedUs != 0) {
    const uint32_t dt = now - lastAcceptedUs;
    if (dt < MIN_ACCEPTED_SPACING_US) {
      rejectedTotal++;
      if (rejectedSinceAccepted < 65535) rejectedSinceAccepted++;
      return;
    }
  }
  const uint32_t period = lastAcceptedUs == 0 ? 0 : now - lastAcceptedUs;
  lastAcceptedUs = now;
  acceptedTotal++;
  const uint8_t next = (uint8_t)((head + 1U) % QUEUE_SIZE);
  if (next == tail) {
    droppedAcceptedEvents++;
    rejectedSinceAccepted = 0;
    return;
  }
  eventUsQueue[head] = now;
  periodUsQueue[head] = period;
  rejectedQueue[head] = rejectedSinceAccepted;
  rejectedSinceAccepted = 0;
  head = next;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onEdge, FALLING);
  Serial.println("accepted_event_index,event_us,period_us,frequency_hz,rejected_since_previous,total_rejected,dropped_accepted_events,emit_lag_us");
}

void loop() {
  noInterrupts();
  if (tail == head) { interrupts(); return; }
  const uint32_t eventUs = eventUsQueue[tail];
  const uint32_t periodUs = periodUsQueue[tail];
  const uint16_t rejected = rejectedQueue[tail];
  tail = (uint8_t)((tail + 1U) % QUEUE_SIZE);
  const uint32_t index = acceptedTotal;
  const uint32_t rejectedAll = rejectedTotal;
  const uint32_t dropped = droppedAcceptedEvents;
  interrupts();

  const uint32_t emittedUs = micros();
  const float frequency = periodUs > 0 ? 1000000.0f/(float)periodUs : 0.0f;
  Serial.print(index); Serial.print(','); Serial.print(eventUs); Serial.print(',');
  Serial.print(periodUs); Serial.print(','); Serial.print(frequency,7); Serial.print(',');
  Serial.print(rejected); Serial.print(','); Serial.print(rejectedAll); Serial.print(',');
  Serial.print(dropped); Serial.print(','); Serial.println(emittedUs - eventUs);
}
