#include <Arduino.h>

const uint8_t PIR_PIN = 3;
const uint32_t BAUD = 115200;

int lastState = LOW;
uint32_t riseUs = 0;
uint32_t eventIndex = 0;

void setup() {
  Serial.begin(BAUD);
  pinMode(PIR_PIN, INPUT);
  lastState = digitalRead(PIR_PIN);
  Serial.println("event_index,event_type,time_us,high_duration_us,state");
}

void loop() {
  const int state = digitalRead(PIR_PIN);
  if (state != lastState) {
    const uint32_t now = micros();
    eventIndex++;
    if (state == HIGH) {
      riseUs = now;
      Serial.print(eventIndex); Serial.print(',');
      Serial.print(1); Serial.print(',');
      Serial.print(now); Serial.print(',');
      Serial.print(0); Serial.print(',');
      Serial.println(state);
    } else {
      const uint32_t duration = riseUs == 0 ? 0 : now - riseUs;
      Serial.print(eventIndex); Serial.print(',');
      Serial.print(0); Serial.print(',');
      Serial.print(now); Serial.print(',');
      Serial.print(duration); Serial.print(',');
      Serial.println(state);
    }
    lastState = state;
  }
}
