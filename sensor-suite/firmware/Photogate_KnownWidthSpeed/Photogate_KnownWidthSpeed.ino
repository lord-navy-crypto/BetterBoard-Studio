// BetterBoard Sensor Suite — known-width photogate speed
#ifndef BB_FLAG_WIDTH_M
#define BB_FLAG_WIDTH_M 0.020
#endif
constexpr uint8_t GATE_PIN = 2;
volatile unsigned long blocked_start_us = 0;
volatile unsigned long blocked_duration_us = 0;
volatile bool ready = false;
void onGateChange() {
  const bool blocked = digitalRead(GATE_PIN) == LOW;
  const unsigned long now = micros();
  if (blocked) blocked_start_us = now;
  else if (blocked_start_us != 0) { blocked_duration_us = now - blocked_start_us; ready = true; blocked_start_us = 0; }
}
void setup() {
  Serial.begin(115200);
  pinMode(GATE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(GATE_PIN), onGateChange, CHANGE);
}
void loop() {
  noInterrupts();
  if (!ready) { interrupts(); return; }
  const unsigned long dt = blocked_duration_us; ready = false;
  interrupts();
  const float speed = dt > 0 ? (float)BB_FLAG_WIDTH_M / ((float)dt * 1.0e-6f) : 0.0f;
  Serial.print(micros()); Serial.print(','); Serial.print(dt); Serial.print(','); Serial.println(speed, 6);
}
