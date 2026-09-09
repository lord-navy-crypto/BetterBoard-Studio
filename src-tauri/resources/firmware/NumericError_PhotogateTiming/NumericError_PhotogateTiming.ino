#include <Arduino.h>
#include <math.h>

const uint8_t SENSOR_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t MIN_EDGE_US = 2000UL;

volatile uint32_t lastEdgeUs = 0;
volatile uint32_t latestPeriodUs = 0;
volatile bool newPeriod = false;

void onEdge() {
  const uint32_t now = micros();
  const uint32_t dt = now - lastEdgeUs;
  if (lastEdgeUs != 0 && dt >= MIN_EDGE_US) {
    latestPeriodUs = dt;
    newPeriod = true;
  }
  lastEdgeUs = now;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onEdge, FALLING);
  Serial.println("event_us,period_us,frequency_hz,period_ms");
}

void loop() {
  noInterrupts();
  const bool ready = newPeriod;
  const uint32_t period = latestPeriodUs;
  const uint32_t eventTime = lastEdgeUs;
  if (ready) newPeriod = false;
  interrupts();

  if (ready && period > 0) {
    const float frequency = 1000000.0f / (float)period;
    Serial.print(eventTime); Serial.print(',');
    Serial.print(period); Serial.print(',');
    Serial.print(frequency, 6); Serial.print(',');
    Serial.println(period / 1000.0f, 6);
  }
}
