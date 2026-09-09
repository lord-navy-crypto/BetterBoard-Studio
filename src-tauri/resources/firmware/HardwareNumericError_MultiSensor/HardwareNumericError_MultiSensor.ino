#include <Arduino.h>

// BetterBoard Hardware Numeric Error Depth 2 — Combined event/sampling lab
// Confirmed hardware path: A0 potentiometer, D2 photogate/optical pulse,
// D3 PIR, optional LED on D9. Fixed-rate sampling and asynchronous event
// counters coexist so coalescing/event-loss risk is visible instead of hidden.

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif
#ifndef BB_MIN_ACCEPTED_PHOTO_SPACING_US
#define BB_MIN_ACCEPTED_PHOTO_SPACING_US 2000UL
#endif
#ifndef BB_EMA_ALPHA
#define BB_EMA_ALPHA 0.20f
#endif
#ifndef BB_TIMER_QUANTUM_US
#define BB_TIMER_QUANTUM_US 4UL
#endif
#ifndef BB_PHOTO_INPUT_MODE
#define BB_PHOTO_INPUT_MODE INPUT_PULLUP
#endif
#ifndef BB_PHOTO_INTERRUPT_MODE
#define BB_PHOTO_INTERRUPT_MODE FALLING
#endif
#ifndef BB_PIR_INPUT_MODE
#define BB_PIR_INPUT_MODE INPUT
#endif
#ifndef BB_PIR_INTERRUPT_MODE
#define BB_PIR_INTERRUPT_MODE CHANGE
#endif

const uint8_t POT_PIN = A0;
const uint8_t PHOTO_PIN = 2;
const uint8_t PIR_PIN = 3;
const uint8_t LED_PIN = 9;
const uint32_t SAMPLE_INTERVAL_US = (uint32_t)BB_SAMPLE_INTERVAL_US;
const uint32_t MIN_ACCEPTED_PHOTO_SPACING_US = (uint32_t)BB_MIN_ACCEPTED_PHOTO_SPACING_US;
const float EMA_ALPHA = (float)BB_EMA_ALPHA;
const uint32_t TIMER_QUANTUM_US = (uint32_t)BB_TIMER_QUANTUM_US;

volatile uint32_t photoLastAcceptedUs = 0;
volatile uint32_t photoLatestPeriodUs = 0;
volatile uint32_t photoEventTotal = 0;
volatile uint32_t photoRejectedTotal = 0;
volatile uint16_t photoEventsSinceSample = 0;
volatile uint16_t photoRejectedSinceSample = 0;
volatile uint32_t pirEdgeTotal = 0;
volatile uint16_t pirEdgesSinceSample = 0;
volatile uint32_t pirLatestEdgeUs = 0;
volatile uint8_t pirLatestState = LOW;

uint32_t scheduledUs = 0;
uint32_t sampleIndex = 0;
float emaCounts = 0.0f;
bool emaReady = false;

uint16_t requantize10to8(uint16_t raw10) {
  return (uint16_t)(((uint32_t)raw10 * 255UL + 511UL) / 1023UL);
}

void onPhotoEdge() {
  const uint32_t now = micros();
  if (photoLastAcceptedUs != 0) {
    const uint32_t dt = (uint32_t)(now - photoLastAcceptedUs);
    if (dt < MIN_ACCEPTED_PHOTO_SPACING_US) {
      photoRejectedTotal++;
      if (photoRejectedSinceSample < 65535U) photoRejectedSinceSample++;
      return;
    }
    photoLatestPeriodUs = dt;
  }
  photoLastAcceptedUs = now;
  photoEventTotal++;
  if (photoEventsSinceSample < 65535U) photoEventsSinceSample++;
}

void onPirChange() {
  pirLatestEdgeUs = micros();
  pirLatestState = (uint8_t)digitalRead(PIR_PIN);
  pirEdgeTotal++;
  if (pirEdgesSinceSample < 65535U) pirEdgesSinceSample++;
}

void setup() {
  Serial.begin(115200);
  pinMode(POT_PIN, INPUT);
  pinMode(PHOTO_PIN, BB_PHOTO_INPUT_MODE);
  pinMode(PIR_PIN, BB_PIR_INPUT_MODE);
  pinMode(LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PHOTO_PIN), onPhotoEdge, BB_PHOTO_INTERRUPT_MODE);
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), onPirChange, BB_PIR_INTERRUPT_MODE);
  scheduledUs = micros();
  Serial.println("sample_index,scheduled_us,actual_us,schedule_lateness_us,raw10,q8,recon8_counts,ema_counts,pwm8,pir_state,pir_latest_edge_us,pir_edges_since_sample,pir_edge_total,pir_coalesced,photo_period_us,photo_frequency_hz,photo_events_since_sample,photo_event_total,photo_coalesced,photo_rejected_since_sample,photo_rejected_total,timer_quantum_us");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - scheduledUs) < SAMPLE_INTERVAL_US) return;
  scheduledUs += SAMPLE_INTERVAL_US;
  const uint32_t actualUs = micros();
  const uint32_t latenessUs = (uint32_t)(actualUs - scheduledUs);

  const uint16_t raw = (uint16_t)analogRead(POT_PIN);
  const uint16_t q8 = requantize10to8(raw);
  const float recon8 = ((float)q8 * 1023.0f) / 255.0f;
  if (!emaReady) {
    emaCounts = (float)raw;
    emaReady = true;
  } else {
    emaCounts += EMA_ALPHA * ((float)raw - emaCounts);
  }
  analogWrite(LED_PIN, (uint8_t)q8);

  noInterrupts();
  const uint32_t pPeriod = photoLatestPeriodUs;
  const uint32_t pTotal = photoEventTotal;
  const uint16_t pSince = photoEventsSinceSample;
  const uint16_t pRejectedSince = photoRejectedSinceSample;
  const uint32_t pRejectedTotal = photoRejectedTotal;
  photoEventsSinceSample = 0;
  photoRejectedSinceSample = 0;
  const uint32_t pirTotal = pirEdgeTotal;
  const uint16_t pirSince = pirEdgesSinceSample;
  const uint32_t pirEdgeUs = pirLatestEdgeUs;
  const uint8_t pirState = pirLatestState;
  pirEdgesSinceSample = 0;
  interrupts();

  const bool havePhotoPeriod = pTotal >= 2 && pPeriod > 0;
  const float photoFrequencyHz = havePhotoPeriod ? 1000000.0f / (float)pPeriod : 0.0f;

  Serial.print(sampleIndex++); Serial.print(',');
  Serial.print(scheduledUs); Serial.print(',');
  Serial.print(actualUs); Serial.print(',');
  Serial.print(latenessUs); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(q8); Serial.print(',');
  Serial.print(recon8, 6); Serial.print(',');
  Serial.print(emaCounts, 6); Serial.print(',');
  Serial.print(q8); Serial.print(',');
  Serial.print(pirState); Serial.print(',');
  Serial.print(pirEdgeUs); Serial.print(',');
  Serial.print(pirSince); Serial.print(',');
  Serial.print(pirTotal); Serial.print(',');
  Serial.print(pirSince > 1 ? 1 : 0); Serial.print(',');
  Serial.print(havePhotoPeriod ? pPeriod : 0); Serial.print(',');
  Serial.print(photoFrequencyHz, 9); Serial.print(',');
  Serial.print(pSince); Serial.print(',');
  Serial.print(pTotal); Serial.print(',');
  Serial.print(pSince > 1 ? 1 : 0); Serial.print(',');
  Serial.print(pRejectedSince); Serial.print(',');
  Serial.print(pRejectedTotal); Serial.print(',');
  Serial.println(TIMER_QUANTUM_US);
}
