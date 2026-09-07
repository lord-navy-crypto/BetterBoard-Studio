const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;

// Replace with the effective quadrature counts per full revolution
// for the actual encoder.
const long COUNTS_PER_REVOLUTION = 600;

const unsigned long SAMPLE_INTERVAL_US = 10000UL; // 100 Hz

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

  const float angle_deg =
      360.0f * float(count) / float(COUNTS_PER_REVOLUTION);

  // time_us,count,angle_deg
  Serial.print(now);
  Serial.print(',');
  Serial.print(count);
  Serial.print(',');
  Serial.println(angle_deg, 5);
}
