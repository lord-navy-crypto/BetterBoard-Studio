#include <Arduino.h>

// BetterBoard Numeric Error Depth — Filter Lag V2
// A0 is measured at a scheduled cadence. Two EMAs expose the tradeoff between
// smoothing and tracking lag. Timing evidence is emitted so lag is not confused
// with scheduler delay.

const uint8_t ANALOG_PIN = A0;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 20000UL;
const float NOMINAL_VREF_V = 5.0f;
const float ALPHA_FAST = 0.35f;
const float ALPHA_SLOW = 0.08f;

uint32_t nextSampleUs = 0;
uint32_t previousSampleUs = 0;
float emaFast = 0.0f;
float emaSlow = 0.0f;
bool initialized = false;

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  nextSampleUs = micros();
  Serial.println("sample_us,scheduled_us,lateness_us,dt_us,raw_adc,nominal_voltage_v,ema_fast_v,ema_slow_v,fast_residual_v,slow_residual_v,alpha_fast,alpha_slow");
}

void loop() {
  const uint32_t now = micros();
  if ((int32_t)(now - nextSampleUs) < 0) return;
  const uint32_t scheduledUs = nextSampleUs;
  nextSampleUs += SAMPLE_INTERVAL_US;
  const uint32_t sampleUs = micros();
  const uint32_t latenessUs = sampleUs - scheduledUs;
  const uint32_t dtUs = previousSampleUs == 0 ? 0 : sampleUs - previousSampleUs;
  previousSampleUs = sampleUs;

  const int raw = analogRead(ANALOG_PIN);
  const float voltage = raw * NOMINAL_VREF_V / 1023.0f;
  if (!initialized) {
    emaFast = voltage; emaSlow = voltage; initialized = true;
  } else {
    emaFast += ALPHA_FAST * (voltage - emaFast);
    emaSlow += ALPHA_SLOW * (voltage - emaSlow);
  }

  Serial.print(sampleUs); Serial.print(','); Serial.print(scheduledUs); Serial.print(',');
  Serial.print(latenessUs); Serial.print(','); Serial.print(dtUs); Serial.print(',');
  Serial.print(raw); Serial.print(','); Serial.print(voltage, 7); Serial.print(',');
  Serial.print(emaFast, 7); Serial.print(','); Serial.print(emaSlow, 7); Serial.print(',');
  Serial.print(emaFast - voltage, 7); Serial.print(','); Serial.print(emaSlow - voltage, 7); Serial.print(',');
  Serial.print(ALPHA_FAST, 4); Serial.print(','); Serial.println(ALPHA_SLOW, 4);
}
