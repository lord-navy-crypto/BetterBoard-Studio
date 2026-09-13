#include <BetterBoard.h>

const uint8_t GATE_PIN = 2;
volatile unsigned long event_us = 0;
volatile unsigned long dropped_events = 0;
volatile bool event_pending = false;

betterboard::experiments::EngineeringLabStream stream(Serial);

void onGate() {
  if (!event_pending) {
    event_us = micros();
    event_pending = true;
  } else {
    dropped_events++;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(GATE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(GATE_PIN), onGate, FALLING);
  stream.begin("el-oscillation-photogate-period",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,period_s,frequency_hz,event_index,event_dt_us,dispatch_latency_us,dropped_events,quality_flags",
               "us,s,Hz,count,us,us,count,bitmask",
               0,
               "schema=v2;edge=falling;input_pullup=true;timestamp=isr");
}

void loop() {
  noInterrupts();
  const bool pending = event_pending;
  const unsigned long now = event_us;
  const unsigned long dropped = dropped_events;
  event_pending = false;
  interrupts();
  if (!pending) return;

  const unsigned long dispatch_latency_us = micros() - now;
  static unsigned long previous_us = 0;
  static unsigned long event_index = 0;
  static unsigned long previous_dropped = 0;
  event_index++;

  const unsigned long event_dt_us = previous_us == 0 ? 0 : now - previous_us;
  double period_s = 0.0;
  double frequency_hz = 0.0;
  uint16_t quality = betterboard::experiments::evidence::Valid;
  if (previous_us != 0) {
    period_s = event_dt_us * 1.0e-6;
    if (period_s > 0.0) frequency_hz = 1.0 / period_s;
  } else {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::DerivedUnavailable);
  }
  if (dropped != previous_dropped) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::EventDropped);
  }
  previous_dropped = dropped;
  previous_us = now;

  stream.rowBegin(now);
  stream.field(period_s, 8); stream.field(frequency_hz, 6); stream.field(event_index);
  stream.field(event_dt_us); stream.field(dispatch_latency_us); stream.field(dropped);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
