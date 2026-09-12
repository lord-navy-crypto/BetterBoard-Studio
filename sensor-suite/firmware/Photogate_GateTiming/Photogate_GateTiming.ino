#include <Arduino.h>

#ifndef BB_GATE_PIN
#define BB_GATE_PIN 2
#endif

static int lastState = HIGH;
static unsigned long lastEdgeUs = 0;
static unsigned long blockedUs = 0;
static unsigned long openUs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(BB_GATE_PIN, INPUT_PULLUP);
  lastState = digitalRead(BB_GATE_PIN);
  lastEdgeUs = micros();
}

void loop() {
  const int state = digitalRead(BB_GATE_PIN);
  if (state == lastState) return;

  const unsigned long now = micros();
  const unsigned long duration = now - lastEdgeUs;
  if (lastState == LOW) blockedUs = duration;
  else openUs = duration;

  Serial.print(now); Serial.print(',');
  Serial.print(state); Serial.print(',');
  Serial.print(blockedUs); Serial.print(',');
  Serial.print(openUs); Serial.print(',');
  const unsigned long cycle = blockedUs + openUs;
  const float duty = cycle > 0 ? 100.0f * (float)blockedUs / (float)cycle : 0.0f;
  Serial.println(duty, 4);

  lastState = state;
  lastEdgeUs = now;
}
