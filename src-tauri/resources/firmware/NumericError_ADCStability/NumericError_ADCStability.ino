#include <Arduino.h>
#include <math.h>

const uint8_t ANALOG_PIN = A0;
const uint32_t BAUD = 115200;
const uint16_t WINDOW_SAMPLES = 100;
const uint32_t SAMPLE_INTERVAL_US = 10000UL;
const float NOMINAL_VREF = 5.0f;

uint16_t samples[WINDOW_SAMPLES];
uint16_t indexInWindow = 0;
uint32_t lastSampleUs = 0;

void emitWindow(uint32_t timeUs) {
  uint32_t sum = 0;
  uint16_t minV = 1023;
  uint16_t maxV = 0;
  for (uint16_t i = 0; i < WINDOW_SAMPLES; ++i) {
    const uint16_t v = samples[i];
    sum += v;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const float mean = (float)sum / WINDOW_SAMPLES;
  float varSum = 0.0f;
  for (uint16_t i = 0; i < WINDOW_SAMPLES; ++i) {
    const float d = (float)samples[i] - mean;
    varSum += d * d;
  }
  const float stddev = sqrtf(varSum / WINDOW_SAMPLES);
  const uint16_t p2p = maxV - minV;
  const float meanVoltage = mean * NOMINAL_VREF / 1023.0f;

  Serial.print(timeUs); Serial.print(',');
  Serial.print(mean, 4); Serial.print(',');
  Serial.print(minV); Serial.print(',');
  Serial.print(maxV); Serial.print(',');
  Serial.print(p2p); Serial.print(',');
  Serial.print(stddev, 4); Serial.print(',');
  Serial.println(meanVoltage, 6);
}

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  Serial.println("time_us,mean_adc,min_adc,max_adc,peak_to_peak_adc,stddev_adc,nominal_mean_voltage_v");
}

void loop() {
  const uint32_t now = micros();
  if ((uint32_t)(now - lastSampleUs) < SAMPLE_INTERVAL_US) return;
  lastSampleUs += SAMPLE_INTERVAL_US;
  samples[indexInWindow++] = analogRead(ANALOG_PIN);
  if (indexInWindow >= WINDOW_SAMPLES) {
    indexInWindow = 0;
    emitWindow(now);
  }
}
