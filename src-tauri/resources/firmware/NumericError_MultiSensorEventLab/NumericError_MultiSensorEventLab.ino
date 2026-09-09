#include <Arduino.h>
#include <math.h>

// User hardware mapping for the multi-sensor lab:
// A0 = potentiometer
// D2 = photogate / encoder pulse input
// D3 = PIR digital input
// D4 = push switch (INPUT_PULLUP)
// D9 = LED PWM output

const uint8_t POT_PIN = A0;
const uint8_t PHOTO_PIN = 2;
const uint8_t PIR_PIN = 3;
const uint8_t SWITCH_PIN = 4;
const uint8_t LED_PIN = 9;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 20000UL; // 50 Hz

volatile uint32_t photoEdgeUs = 0;
volatile uint32_t photoPeriodUs = 0;
volatile bool newPhotoPeriod = false;
uint32_t lastSampleUs = 0;
float filteredV = 0.0f;
bool filterInit = false;

void onPhotoEdge() {
  const uint32_t now = micros();
  if (photoEdgeUs != 0) {
    photoPeriodUs = now - photoEdgeUs;
    newPhotoPeriod = true;
  }
  photoEdgeUs = now;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(POT_PIN, INPUT);
  pinMode(PHOTO_PIN, INPUT_PULLUP);
  pinMode(PIR_PIN, INPUT);
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN), onPhotoEdge, FALLING);
  Serial.println("time_us,raw_adc,voltage_v,filtered_v,filter_error_v,pwm8,pir_state,switch_state,photo_period_us,photo_frequency_hz");
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
  const uint32_t period = photoPeriodUs;
  const bool havePeriod = newPhotoPeriod;
  if (havePeriod) newPhotoPeriod = false;
  interrupts();

  const float frequency = (havePeriod && period > 0) ? (1000000.0f / (float)period) : 0.0f;

  Serial.print(now); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(voltage, 6); Serial.print(',');
  Serial.print(filteredV, 6); Serial.print(',');
  Serial.print(filteredV - voltage, 6); Serial.print(',');
  Serial.print(pwm); Serial.print(',');
  Serial.print(digitalRead(PIR_PIN)); Serial.print(',');
  Serial.print(digitalRead(SWITCH_PIN)); Serial.print(',');
  Serial.print(havePeriod ? period : 0); Serial.print(',');
  Serial.println(frequency, 6);
}
