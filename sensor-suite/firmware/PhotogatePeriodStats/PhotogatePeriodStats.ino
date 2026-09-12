#ifndef BB_MIN_EDGE_SPACING_US
#define BB_MIN_EDGE_SPACING_US 2000UL
#endif
#ifndef BB_WINDOW_EVENTS
#define BB_WINDOW_EVENTS 8
#endif

const uint8_t GATE_PIN = 2;
volatile unsigned long previous_edge_us = 0;
volatile unsigned long latest_period_us = 0;
volatile bool event_ready = false;
unsigned long event_index = 0;
unsigned int window_n = 0;
double mean_period = 0.0;
double m2_period = 0.0;

void onGateEdge() {
  const unsigned long now = micros();
  if (previous_edge_us != 0 && (unsigned long)(now - previous_edge_us) < (unsigned long)BB_MIN_EDGE_SPACING_US) return;
  if (previous_edge_us != 0) {
    latest_period_us = now - previous_edge_us;
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
  const unsigned long period = latest_period_us;
  if (ready) event_ready = false;
  interrupts();
  if (!ready || period == 0) return;

  ++event_index;
  ++window_n;
  const double delta = period - mean_period;
  mean_period += delta / window_n;
  m2_period += delta * (period - mean_period);
  const double frequency = 1000000.0 / period;

  if (window_n >= (unsigned int)BB_WINDOW_EVENTS) {
    const double std_us = window_n > 1 ? sqrt(m2_period / (window_n - 1)) : 0.0;
    Serial.print(micros()); Serial.print(',');
    Serial.print(event_index); Serial.print(',');
    Serial.print(period); Serial.print(',');
    Serial.print(frequency, 7); Serial.print(',');
    Serial.print(mean_period, 3); Serial.print(',');
    Serial.println(std_us, 3);
    window_n = 0; mean_period = 0.0; m2_period = 0.0;
  }
}
