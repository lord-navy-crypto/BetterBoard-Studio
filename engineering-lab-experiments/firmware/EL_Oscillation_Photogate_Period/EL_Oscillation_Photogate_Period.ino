#include <BetterBoard.h>

struct GateEvent {
  uint32_t event_dt_us;
  uint32_t dispatch_latency_us;
  uint32_t dropped_events;
};

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
               "schema=v2;edge=falling;input_pullup=true;timestamp=isr;acquisition_contract=v3-event");
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

  GateEvent event;
  event.event_dt_us = previous_us == 0 ? 0 : now - previous_us;
  event.dispatch_latency_us = dispatch_latency_us;
  event.dropped_events = dropped;

  uint16_t flags = betterboard::experiments::evidence::Valid;
  if (previous_us == 0) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::DerivedUnavailable);
  }
  if (dropped != previous_dropped) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::EventDropped);
  }

  const betterboard::measurement::AcquisitionResult<GateEvent> acquisition =
      betterboard::measurement::AcquisitionResult<GateEvent>::success(
          event, now, dispatch_latency_us);
  const betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          event_index, event.event_dt_us, acquisition, flags);

  double period_s = 0.0;
  double frequency_hz = 0.0;
  if (previous_us != 0) {
    period_s = event.event_dt_us * 1.0e-6;
    if (period_s > 0.0) frequency_hz = 1.0 / period_s;
  }

  previous_dropped = dropped;
  previous_us = now;

  stream.rowBegin(record.timestamp_us);
  stream.field(period_s, 8);
  stream.field(frequency_hz, 6);
  stream.field(record.sequence_id);
  stream.field(record.sample_dt_us);
  stream.field(event.dispatch_latency_us);
  stream.field(event.dropped_events);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
