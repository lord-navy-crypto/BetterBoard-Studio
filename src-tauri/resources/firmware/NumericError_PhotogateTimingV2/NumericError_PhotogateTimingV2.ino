#include <Arduino.h>

// BetterBoard Numeric Error — Photogate Timing V2
// D2 input, INPUT_PULLUP, FALLING edge.
// Rejected close edges DO NOT move the accepted timing baseline.

const uint8_t SENSOR_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t MIN_ACCEPTED_SPACING_US = 2000UL;

volatile uint32_t lastAcceptedEdgeUs = 0;
volatile uint32_t latestAcceptedEventUs = 0;
volatile uint32_t latestPeriodUs = 0;
volatile uint32_t acceptedEventIndex = 0;
volatile uint32_t totalRejected = 0;
volatile uint16_t rejectedSinceLastAccepted = 0;
volatile uint16_t latestRejectedSinceLast = 0;
volatile bool newAcceptedPeriod = false;

void onEdge() {
  const uint32_t now = micros();

  if (lastAcceptedEdgeUs == 0) {
    lastAcceptedEdgeUs = now;
    latestAcceptedEventUs = now;
    acceptedEventIndex = 1;
    rejectedSinceLastAccepted = 0;
    return;
  }

  const uint32_t dt = now - lastAcceptedEdgeUs;
  if (dt < MIN_ACCEPTED_SPACING_US) {
    totalRejected++;
    if (rejectedSinceLastAccepted < 65535) rejectedSinceLastAccepted++;
    return;
  }

  latestPeriodUs = dt;
  latestAcceptedEventUs = now;
  lastAcceptedEdgeUs = now;
  acceptedEventIndex++;
  latestRejectedSinceLast = rejectedSinceLastAccepted;
  rejectedSinceLastAccepted = 0;
  newAcceptedPeriod = true;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onEdge, FALLING);
  Serial.println("accepted_event_index,event_us,period_us,frequency_hz,rejected_since_last,total_rejected");
}

void loop() {
  noInterrupts();
  const bool ready = newAcceptedPeriod;
  const uint32_t index = acceptedEventIndex;
  const uint32_t eventUs = latestAcceptedEventUs;
  const uint32_t periodUs = latestPeriodUs;
  const uint16_t rejected = latestRejectedSinceLast;
  const uint32_t rejectedTotal = totalRejected;
  if (ready) newAcceptedPeriod = false;
  interrupts();

  if (!ready || periodUs == 0) return;

  const float frequencyHz = 1000000.0f / (float)periodUs;
  Serial.print(index); Serial.print(',');
  Serial.print(eventUs); Serial.print(',');
  Serial.print(periodUs); Serial.print(',');
  Serial.print(frequencyHz, 6); Serial.print(',');
  Serial.print(rejected); Serial.print(',');
  Serial.println(rejectedTotal);
}
