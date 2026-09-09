#include <Arduino.h>

// BetterBoard Numeric Error Depth — PIR Timing V2
// Records observed PIR transitions and high-state durations. This measures the
// digital output timing seen by the MCU; it does not claim sensor-internal latency
// without an independent physical trigger reference.

const uint8_t PIR_PIN = 3;
const uint32_t BAUD = 115200;
int lastState = LOW;
uint32_t riseUs = 0;
uint32_t eventIndex = 0;
uint32_t loopPolls = 0;

void setup() {
  Serial.begin(BAUD);
  pinMode(PIR_PIN, INPUT);
  lastState = digitalRead(PIR_PIN);
  Serial.println("event_index,event_type,time_us,high_duration_us,state,polls_since_previous_event");
}

void loop() {
  loopPolls++;
  const int state = digitalRead(PIR_PIN);
  if (state == lastState) return;
  const uint32_t now = micros();
  eventIndex++;
  const uint32_t polls = loopPolls;
  loopPolls = 0;
  uint32_t duration = 0;
  if (state == HIGH) riseUs = now;
  else if (riseUs != 0) duration = now - riseUs;
  Serial.print(eventIndex); Serial.print(',');
  Serial.print(state == HIGH ? 1 : 0); Serial.print(',');
  Serial.print(now); Serial.print(','); Serial.print(duration); Serial.print(',');
  Serial.print(state); Serial.print(','); Serial.println(polls);
  lastState = state;
}
