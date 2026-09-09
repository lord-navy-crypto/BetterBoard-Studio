#ifndef BB_PULSES_PER_REVOLUTION
#define BB_PULSES_PER_REVOLUTION 1.0
#endif
#ifndef BB_MIN_PULSE_SPACING_US
#define BB_MIN_PULSE_SPACING_US 1000
#endif
const uint8_t PULSE_PIN = 2;
const float PULSES_PER_REVOLUTION = (float)BB_PULSES_PER_REVOLUTION;
const unsigned long MIN_PULSE_SPACING_US = (unsigned long)BB_MIN_PULSE_SPACING_US;
volatile unsigned long previous_pulse_us = 0;
volatile unsigned long latest_period_us = 0;
volatile bool period_ready = false;

void onPulse() {
  const unsigned long now = micros();
  if (previous_pulse_us != 0) {
    const unsigned long dt = (unsigned long)(now - previous_pulse_us);
    if (dt >= MIN_PULSE_SPACING_US) {
      latest_period_us = dt;
      period_ready = true;
    }
  }
  previous_pulse_us = now;
}
void setup() {
  Serial.begin(115200);
  pinMode(PULSE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PULSE_PIN), onPulse, FALLING);
}
void loop() {
  noInterrupts();
  const bool ready = period_ready;
  const unsigned long period_us = latest_period_us;
  if (ready) period_ready = false;
  interrupts();
  if (!ready || period_us == 0 || PULSES_PER_REVOLUTION <= 0.0f) return;
  const float rpm = 60000000.0f / (float(period_us) * PULSES_PER_REVOLUTION);
  Serial.print(micros());
  Serial.print(',');
  Serial.print(period_us);
  Serial.print(',');
  Serial.println(rpm, 5);
}
