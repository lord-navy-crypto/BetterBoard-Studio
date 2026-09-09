#include <Arduino.h>

// BetterBoard Hardware Numeric Error Depth 2 — Photogate / optical encoder timing
// D2 interrupt input. Rejected close edges never move the accepted baseline.
// Input mode and interrupt polarity are compile-time configurable because
// optical modules differ in electrical output behavior.

#ifndef BB_MIN_ACCEPTED_SPACING_US
#define BB_MIN_ACCEPTED_SPACING_US 2000UL
#endif
#ifndef BB_PULSES_PER_REVOLUTION
#define BB_PULSES_PER_REVOLUTION 1.0f
#endif
#ifndef BB_TIMER_QUANTUM_US
#define BB_TIMER_QUANTUM_US 4UL
#endif
#ifndef BB_PHOTO_INPUT_MODE
#define BB_PHOTO_INPUT_MODE INPUT_PULLUP
#endif
#ifndef BB_PHOTO_INTERRUPT_MODE
#define BB_PHOTO_INTERRUPT_MODE FALLING
#endif

const uint8_t SENSOR_PIN = 2;
const uint32_t MIN_ACCEPTED_SPACING_US = (uint32_t)BB_MIN_ACCEPTED_SPACING_US;
const float PULSES_PER_REVOLUTION = (float)BB_PULSES_PER_REVOLUTION;
const uint32_t TIMER_QUANTUM_US = (uint32_t)BB_TIMER_QUANTUM_US;

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
  const uint32_t dt = (uint32_t)(now - lastAcceptedEdgeUs);
  if (dt < MIN_ACCEPTED_SPACING_US) {
    totalRejected++;
    if (rejectedSinceLastAccepted < 65535U) rejectedSinceLastAccepted++;
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
  Serial.begin(115200);
  pinMode(SENSOR_PIN, BB_PHOTO_INPUT_MODE);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onEdge, BB_PHOTO_INTERRUPT_MODE);
  Serial.println("accepted_event_index,event_us,period_us,frequency_hz,rpm,pulses_per_revolution,timer_quantum_us,rejected_since_last,total_rejected");
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
  if (!ready || periodUs == 0 || PULSES_PER_REVOLUTION <= 0.0f) return;

  const float frequencyHz = 1000000.0f / (float)periodUs;
  const float rpm = (60.0f * frequencyHz) / PULSES_PER_REVOLUTION;
  Serial.print(index); Serial.print(',');
  Serial.print(eventUs); Serial.print(',');
  Serial.print(periodUs); Serial.print(',');
  Serial.print(frequencyHz, 9); Serial.print(',');
  Serial.print(rpm, 9); Serial.print(',');
  Serial.print(PULSES_PER_REVOLUTION, 6); Serial.print(',');
  Serial.print(TIMER_QUANTUM_US); Serial.print(',');
  Serial.print(rejected); Serial.print(',');
  Serial.println(rejectedTotal);
}
