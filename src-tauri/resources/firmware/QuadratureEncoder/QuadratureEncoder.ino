#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000
#endif
const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;
const long COUNTS_PER_REVOLUTION = (long)BB_COUNTS_PER_REVOLUTION;
const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
volatile long encoder_count = 0;
unsigned long last_sample_us = 0;

void onA() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a == b) ? 1 : -1;
}
void onB() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a != b) ? 1 : -1;
}
void setup() {
  Serial.begin(115200);
  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onA, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_B), onB, CHANGE);
}
void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  noInterrupts();
  const long count = encoder_count;
  interrupts();
  const float angle_deg = COUNTS_PER_REVOLUTION > 0 ? 360.0f * float(count) / float(COUNTS_PER_REVOLUTION) : 0.0f;
  Serial.print(now);
  Serial.print(',');
  Serial.print(count);
  Serial.print(',');
  Serial.println(angle_deg, 5);
}
