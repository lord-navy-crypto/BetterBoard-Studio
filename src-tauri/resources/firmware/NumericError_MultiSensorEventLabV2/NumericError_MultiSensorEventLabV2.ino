#include <Arduino.h>

// BetterBoard Numeric Error — MultiSensor Event Lab V2
// A0 potentiometer, D2 photogate, D3 PIR, D4 switch, D9 LED PWM.
// Adds explicit photogate event counters so a 50 Hz sample can distinguish
// 'no event' from 'multiple events coalesced since the previous sample'.

const uint8_t POT_PIN = A0;
const uint8_t PHOTO_PIN = 2;
const uint8_t PIR_PIN = 3;
const uint8_t SWITCH_PIN = 4;
const uint8_t LED_PIN = 9;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 20000UL;
const uint32_t MIN_ACCEPTED_PHOTO_SPACING_US = 2000UL;

volatile uint32_t photoLastAcceptedUs = 0;
volatile uint32_t photoLatestPeriodUs = 0;
volatile uint32_t photoEventCountTotal = 0;
volatile uint32_t photoRejectedTotal = 0;
volatile uint16_t photoEventsSinceSample = 0;
volatile uint16_t photoRejectedSinceSample = 0;

uint32_t lastSampleUs = 0;
float filteredV = 0.0f;
bool filterInit = false;

void onPhotoEdge() {
  const uint32_t now = micros();
  if (photoLastAcceptedUs != 0) {
    const uint32_t dt = now - photoLastAcceptedUs;
    if (dt < MIN_ACCEPTED_PHOTO_SPACING_US) {
      photoRejectedTotal++;
      if (photoRejectedSinceSample < 65535) photoRejectedSinceSample++;
      return;
    }
    photoLatestPeriodUs = dt;
  }
  photoLastAcceptedUs = now;
  photoEventCountTotal++;
  if (photoEventsSinceSample < 65535) photoEventsSinceSample++;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(POT_PIN, INPUT);
  pinMode(PHOTO_PIN, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN), onPhotoEdge, FALLING);
  Serial.println("time_us,raw_adc,voltage_v,filtered_v,filter_error_v,pwm8,pir_state,switch_state,photo_period_us,photo_frequency_hz,photo_event_count_total,photo_events_since_sample,photo_coalesced,photo_rejected_since_sample,photo_rejected_total");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - lastSampleUs) < SAMPLE_INTERVAL_US) return;
  lastSampleUs += SAMPLE_INTERVAL_US;

  const int raw = analogRead(POT_PIN);
  const float voltage = raw * 5.0f / 1023.0f;
  if (!filterInit) {
    filteredV = voltage;
    filterInit = true;
  } else {
    filteredV += 0.20f * (voltage - filteredV);
  }

  const int pwm = (int)((raw / 1023.0f) * 255.0f + 0.5f);
  analogWrite(LED_PIN, pwm);

  noInterrupts();
  const uint32_t period = photoLatestPeriodUs;
  const uint32_t totalEvents = photoEventCountTotal;
  const uint16_t eventsSince = photoEventsSinceSample;
  const uint16_t rejectedSince = photoRejectedSinceSample;
  const uint32_t rejectedTotal = photoRejectedTotal;
  photoEventsSinceSample = 0;
  photoRejectedSinceSample = 0;
  interrupts();

  const bool havePeriod = totalEvents >= 2 && period > 0;
  const float frequency = havePeriod ? (1000000.0f / (float)period) : 0.0f;
  const int coalesced = eventsSince > 1 ? 1 : 0;

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(voltage, 6); Serial.print(',');
  Serial.print(filteredV, 6); Serial.print(',');
  Serial.print(filteredV - voltage, 6); Serial.print(',');
  Serial.print(pwm); Serial.print(',');
  Serial.print(digitalRead(PIR_PIN)); Serial.print(',');
  Serial.print(digitalRead(SWITCH_PIN)); Serial.print(',');
  Serial.print(havePeriod ? period : 0); Serial.print(',');
  Serial.print(frequency, 6); Serial.print(',');
  Serial.print(totalEvents); Serial.print(',');
  Serial.print(eventsSince); Serial.print(',');
  Serial.print(coalesced); Serial.print(',');
  Serial.print(rejectedSince); Serial.print(',');
  Serial.println(rejectedTotal);
}
