#ifndef BB_MIN_EDGE_SPACING_US
#define BB_MIN_EDGE_SPACING_US 2000
#endif
const uint8_t GATE_PIN = 2;
const unsigned long MIN_EDGE_SPACING_US = (unsigned long)BB_MIN_EDGE_SPACING_US;
volatile unsigned long previous_edge_us = 0;
volatile unsigned long latest_edge_us = 0;
volatile unsigned long latest_period_us = 0;
volatile bool event_ready = false;

void onGateEdge() {
  const unsigned long now = micros();
  if (previous_edge_us != 0 && (unsigned long)(now - previous_edge_us) < MIN_EDGE_SPACING_US) return;
  latest_edge_us = now;
  if (previous_edge_us != 0) {
    latest_period_us = (unsigned long)(now - previous_edge_us);
    event_ready = true;
  }
  previous_edge_us = now;
}

void setup() {
  Serial.begin(115200);
  pinMode(GATE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(GATE_PIN), onGateEdge, FALLING);
}

void loop() {
  noInterrupts();
  const bool ready = event_ready;
  const unsigned long event_us = latest_edge_us;
  const unsigned long period_us = latest_period_us;
  if (ready) event_ready = false;
  interrupts();
  if (!ready || period_us == 0) return;
  const float frequency_hz = 1000000.0f / float(period_us);
  Serial.print(event_us);
  Serial.print(',');
  Serial.print(period_us);
  Serial.print(',');
  Serial.println(frequency_hz, 6);
}
