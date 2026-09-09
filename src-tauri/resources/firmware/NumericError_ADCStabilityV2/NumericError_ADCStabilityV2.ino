#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error Depth — ADC Stability V2
// A0 window statistics with real sample timing evidence.
// Voltage is explicitly NOMINAL because default AVcc is not a calibrated 5.000 V oracle.

const uint8_t ANALOG_PIN = A0;
const uint32_t BAUD = 115200;
const uint16_t WINDOW_SAMPLES = 100;
const uint32_t SAMPLE_INTERVAL_US = 10000UL;
const float NOMINAL_VREF_V = 5.0f;

uint32_t nextSampleUs = 0;
uint16_t countInWindow = 0;
uint32_t sum = 0;
float mean = 0.0f;
float m2 = 0.0f;
uint16_t minAdc = 1023;
uint16_t maxAdc = 0;
uint32_t maxLatenessUs = 0;

void resetWindow() {
  countInWindow = 0; sum = 0; mean = 0.0f; m2 = 0.0f;
  minAdc = 1023; maxAdc = 0; maxLatenessUs = 0;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  nextSampleUs = micros();
  Serial.println("window_end_us,samples,mean_adc,min_adc,max_adc,peak_to_peak_adc,stddev_adc,nominal_mean_voltage_v,nominal_vref_v,max_sample_lateness_us");
}

void loop() {
  const uint32_t now = micros();
  if ((int32_t)(now - nextSampleUs) < 0) return;
  const uint32_t scheduledUs = nextSampleUs;
  nextSampleUs += SAMPLE_INTERVAL_US;
  const uint32_t sampleUs = micros();
  const uint32_t latenessUs = sampleUs - scheduledUs;
  if (latenessUs > maxLatenessUs) maxLatenessUs = latenessUs;

  const uint16_t value = analogRead(ANALOG_PIN);
  countInWindow++;
  sum += value;
  if (value < minAdc) minAdc = value;
  if (value > maxAdc) maxAdc = value;
  const float delta = (float)value - mean;
  mean += delta / (float)countInWindow;
  const float delta2 = (float)value - mean;
  m2 += delta * delta2;

  if (countInWindow < WINDOW_SAMPLES) return;
  const float stddev = sqrtf(m2 / (float)countInWindow);
  const uint16_t p2p = maxAdc - minAdc;
  const float nominalVoltage = mean * NOMINAL_VREF_V / 1023.0f;
  Serial.print(sampleUs); Serial.print(','); Serial.print(countInWindow); Serial.print(',');
  Serial.print(mean, 5); Serial.print(','); Serial.print(minAdc); Serial.print(',');
  Serial.print(maxAdc); Serial.print(','); Serial.print(p2p); Serial.print(',');
  Serial.print(stddev, 5); Serial.print(','); Serial.print(nominalVoltage, 7); Serial.print(',');
  Serial.print(NOMINAL_VREF_V, 4); Serial.print(','); Serial.println(maxLatenessUs);
  resetWindow();
}
