#include <Arduino.h>

const uint8_t ANALOG_PIN = A0;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 20000UL; // 50 Hz
const float VREF = 5.0f;

float emaFast = 0.0f;
float emaSlow = 0.0f;
bool initialized = false;
uint32_t lastSampleUs = 0;

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  Serial.println("time_us,raw_adc,voltage_v,ema_fast_v,ema_slow_v,fast_error_v,slow_error_v");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - lastSampleUs) < SAMPLE_INTERVAL_US) return;
  lastSampleUs += SAMPLE_INTERVAL_US;

  const int raw = analogRead(ANALOG_PIN);
  const float v = raw * VREF / 1023.0f;
  if (!initialized) {
    emaFast = v;
    emaSlow = v;
    initialized = true;
  } else {
    emaFast += 0.35f * (v - emaFast);
    emaSlow += 0.08f * (v - emaSlow);
  }

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(v, 6); Serial.print(',');
  Serial.print(emaFast, 6); Serial.print(',');
  Serial.print(emaSlow, 6); Serial.print(',');
  Serial.print(emaFast - v, 6); Serial.print(',');
  Serial.println(emaSlow - v, 6);
}
