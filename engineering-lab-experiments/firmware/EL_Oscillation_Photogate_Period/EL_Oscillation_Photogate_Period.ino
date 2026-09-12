#include <BetterBoard.h>

const uint8_t GATE_PIN = 2;
volatile unsigned long event_us = 0;
volatile bool event_pending = false;

betterboard::experiments::EngineeringLabStream stream(Serial);

void onGate() {
  if (!event_pending) {
    event_us = micros();
    event_pending = true;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(GATE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(GATE_PIN), onGate, FALLING);
  stream.begin("el-oscillation-photogate-period",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,period_s,frequency_hz,event_index",
               "us,s,Hz,count",
               0);
}

void loop() {
  noInterrupts();
  const bool pending = event_pending;
  const unsigned long now = event_us;
  event_pending = false;
  interrupts();
  if (!pending) return;

  static unsigned long previous_us = 0;
  static unsigned long event_index = 0;
  event_index++;

  double period_s = 0.0;
  double frequency_hz = 0.0;
  if (previous_us != 0) {
    const unsigned long dt_us = now - previous_us;
    period_s = dt_us * 1.0e-6;
    if (period_s > 0.0) frequency_hz = 1.0 / period_s;
  }
  previous_us = now;

  stream.rowBegin(now);
  stream.field(period_s, 8); stream.field(frequency_hz, 6); stream.field(event_index);
  stream.rowEnd();
}
