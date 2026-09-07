const uint8_t ANALOG_PIN = A0;
const unsigned long SAMPLE_INTERVAL_US = 10000UL; // 100 Hz

unsigned long last_sample_us = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  const int adc = analogRead(ANALOG_PIN);

  // time_us,adc_counts
  Serial.print(now);
  Serial.print(',');
  Serial.println(adc);
}
