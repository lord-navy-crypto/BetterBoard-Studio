#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Photogate Timing
//
// Important semantic rule:
// rejected close edges do NOT move the accepted timing baseline.
// This makes the reported period span accepted physical events rather than
// accidental bounce/noise edges.

const uint8_t SENSOR_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t MIN_EDGE_US = 2000UL;

volatile uint32_t lastAcceptedEdgeUs = 0;
volatile uint32_t latestAcceptedEdgeUs = 0;
volatile uint32_t latestPeriodUs = 0;
volatile uint32_t acceptedEventIndex = 0;
volatile uint16_t rejectedSinceLastAccepted = 0;
volatile uint16_t latestRejectedCount = 0;
volatile bool newPeriod = false;

void onEdge() {
  const uint32_t now = micros();

  // First edge establishes the accepted baseline; there is no period yet.
  if (lastAcceptedEdgeUs == 0) {
    lastAcceptedEdgeUs = now;
    latestAcceptedEdgeUs = now;
    acceptedEventIndex = 1;
    rejectedSinceLastAccepted = 0;
    return;
  }

  const uint32_t dt = now - lastAcceptedEdgeUs;
  if (dt < MIN_EDGE_US) {
    // Reject the edge without modifying lastAcceptedEdgeUs.
    if (rejectedSinceLastAccepted < 65535U) {
      rejectedSinceLastAccepted++;
    }
    return;
  }

  latestPeriodUs = dt;
  lastAcceptedEdgeUs = now;
  latestAcceptedEdgeUs = now;
  acceptedEventIndex++;
  latestRejectedCount = rejectedSinceLastAccepted;
  rejectedSinceLastAccepted = 0;
  newPeriod = true;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onEdge, FALLING);
  Serial.println("event_index,event_us,period_us,frequency_hz,period_ms,rejected_since_last");
}

void loop() {
  noInterrupts();
  const bool ready = newPeriod;
  const uint32_t eventIndex = acceptedEventIndex;
  const uint32_t eventTime = latestAcceptedEdgeUs;
  const uint32_t period = latestPeriodUs;
  const uint16_t rejected = latestRejectedCount;
  if (ready) newPeriod = false;
  interrupts();

  if (!ready || period == 0) return;

  const float frequency = 1000000.0f / (float)period;
  Serial.print(eventIndex); Serial.print(',');
  Serial.print(eventTime); Serial.print(',');
  Serial.print(period); Serial.print(',');
  Serial.print(frequency, 6); Serial.print(',');
  Serial.print(period / 1000.0f, 6); Serial.print(',');
  Serial.println(rejected);
}
