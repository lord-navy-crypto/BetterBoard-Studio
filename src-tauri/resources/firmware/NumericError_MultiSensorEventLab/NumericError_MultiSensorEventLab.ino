#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error — Multi-Sensor Event Lab
//
// Mapping:
// A0 = potentiometer
// D2 = photogate / encoder pulse input
// D3 = PIR digital input
// D4 = push switch (INPUT_PULLUP)
// D9 = LED PWM output
//
// The photogate path reports both event totals and events observed since the
// previous 50 Hz sample. This prevents a zero/last-period field from hiding the
// fact that multiple ISR events occurred between UI samples.

const uint8_t POT_PIN = A0;
const uint8_t PHOTO_PIN = 2;
const uint8_t PIR_PIN = 3;
const uint8_t SWITCH_PIN = 4;
const uint8_t LED_PIN = 9;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 20000UL; // 50 Hz
const uint32_t MIN_PHOTO_EDGE_US = 2000UL;

volatile uint32_t lastAcceptedPhotoEdgeUs = 0;
volatile uint32_t latestPhotoPeriodUs = 0;
volatile uint32_t photoEventCountTotal = 0;
volatile uint16_t photoEventsSinceSample = 0;
volatile uint16_t rejectedPhotoEdgesSinceSample = 0;
volatile bool havePhotoPeriod = false;

uint32_t lastSampleUs = 0;
float filteredV = 0.0f;
bool filterInit = false;

void onPhotoEdge() {
  const uint32_t now = micros();

  if (lastAcceptedPhotoEdgeUs == 0) {
    lastAcceptedPhotoEdgeUs = now;
    photoEventCountTotal = 1;
    if (photoEventsSinceSample < 65535U) photoEventsSinceSample++;
    return;
  }

  const uint32_t dt = now - lastAcceptedPhotoEdgeUs;
  if (dt < MIN_PHOTO_EDGE_US) {
    if (rejectedPhotoEdgesSinceSample < 65535U) rejectedPhotoEdgesSinceSample++;
    return;
  }

  latestPhotoPeriodUs = dt;
  lastAcceptedPhotoEdgeUs = now;
  photoEventCountTotal++;
  if (photoEventsSinceSample < 65535U) photoEventsSinceSample++;
  havePhotoPeriod = true;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(POT_PIN, INPUT);
  pinMode(PHOTO_PIN, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN), onPhotoEdge, FALLING);

  Serial.println(
    "time_us,raw_adc,voltage_v,filtered_v,filter_error_v,pwm8,"
    "pir_state,switch_state,photo_period_us,photo_frequency_hz,"
    "photo_event_total,photo_events_since_sample,rejected_photo_edges_since_sample"
  );
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
  const uint32_t period = latestPhotoPeriodUs;
  const bool periodValid = havePhotoPeriod;
  const uint32_t eventTotal = photoEventCountTotal;
  const uint16_t eventsThisSample = photoEventsSinceSample;
  const uint16_t rejectedThisSample = rejectedPhotoEdgesSinceSample;
  photoEventsSinceSample = 0;
  rejectedPhotoEdgesSinceSample = 0;
  interrupts();

  const float frequency = (periodValid && period > 0)
    ? (1000000.0f / (float)period)
    : 0.0f;

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(voltage, 6); Serial.print(',');
  Serial.print(filteredV, 6); Serial.print(',');
  Serial.print(filteredV - voltage, 6); Serial.print(',');
  Serial.print(pwm); Serial.print(',');
  Serial.print(digitalRead(PIR_PIN)); Serial.print(',');
  Serial.print(digitalRead(SWITCH_PIN)); Serial.print(',');
  Serial.print(periodValid ? period : 0); Serial.print(',');
  Serial.print(frequency, 6); Serial.print(',');
  Serial.print(eventTotal); Serial.print(',');
  Serial.print(eventsThisSample); Serial.print(',');
  Serial.println(rejectedThisSample);
}
