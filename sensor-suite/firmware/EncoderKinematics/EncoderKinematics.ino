#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;
volatile long encoder_count = 0;
unsigned long last_sample_us = 0;
long previous_count = 0;
float previous_omega = 0.0f;

void onEncoderA() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a == b) ? 1 : -1;
}

void setup() {
  Serial.begin(115200);
  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEncoderA, CHANGE);
}

void loop() {
  const unsigned long now = micros();
  const unsigned long elapsed = now - last_sample_us;
  if (elapsed < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  noInterrupts();
  const long count = encoder_count;
  interrupts();

  const float dt = elapsed * 1.0e-6f;
  const float angle_rad = (2.0f * 3.14159265358979323846f * count) / (float)BB_COUNTS_PER_REVOLUTION;
  const long dc = count - previous_count;
  const float omega = dt > 0.0f ? (2.0f * 3.14159265358979323846f * dc) / ((float)BB_COUNTS_PER_REVOLUTION * dt) : 0.0f;
  const float alpha = dt > 0.0f ? (omega - previous_omega) / dt : 0.0f;
  previous_count = count;
  previous_omega = omega;

  Serial.print(now); Serial.print(',');
  Serial.print(count); Serial.print(',');
  Serial.print(angle_rad, 7); Serial.print(',');
  Serial.print(omega, 7); Serial.print(',');
  Serial.println(alpha, 7);
}
