#include <Arduino.h>

const uint8_t SWITCH_PIN = 2;
const uint32_t BAUD = 115200;
const uint32_t OBSERVE_WINDOW_US = 50000UL;

volatile uint32_t firstEdgeUs = 0;
volatile uint32_t lastEdgeUs = 0;
volatile uint16_t edgeCount = 0;
volatile bool activeWindow = false;

void onEdge() {
  const uint32_t now = micros();
  if (!activeWindow) {
    firstEdgeUs = now;
    edgeCount = 0;
    activeWindow = true;
  }
  lastEdgeUs = now;
  edgeCount++;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SWITCH_PIN), onEdge, CHANGE);
  Serial.println("first_edge_us,last_edge_us,bounce_duration_us,edge_count,final_state");
}

void loop() {
  noInterrupts();
  const bool active = activeWindow;
  const uint32_t first = firstEdgeUs;
  const uint32_t last = lastEdgeUs;
  interrupts();

  if (active && (uint32_t)(micros() - last) > OBSERVE_WINDOW_US) {
    noInterrupts();
    const uint16_t count = edgeCount;
    activeWindow = false;
    interrupts();

    Serial.print(first); Serial.print(',');
    Serial.print(last); Serial.print(',');
    Serial.print(last - first); Serial.print(',');
    Serial.print(count); Serial.print(',');
    Serial.println(digitalRead(SWITCH_PIN));
  }
}
