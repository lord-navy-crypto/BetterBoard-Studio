#include <Arduino.h>
#include <math.h>

// BetterBoard Numeric Error Depth — Signal Chain Lab V1
// Integrates the overlapping ADC stability, ADC quantization, EMA filter-lag,
// and PWM quantization experiments into one synchronized A0 -> processing -> D9 chain.
// Standalone firmware remains useful as a single-factor control, but this program
// is the preferred integrated experiment for end-to-end measurement evidence.

const uint8_t ANALOG_PIN = A0;
const uint8_t PWM_PIN = 9;
const uint32_t BAUD = 115200;
const uint32_t SAMPLE_INTERVAL_US = 20000UL;  // 50 Hz nominal
const uint16_t WINDOW_SAMPLES = 50;           // 1 s nominal window
const float NOMINAL_VREF_V = 5.0f;
const float EMA_ALPHA = 0.20f;

uint32_t nextSampleUs = 0;
uint32_t previousSampleUs = 0;
uint16_t windowCount = 0;
float meanAdc = 0.0f;
float m2Adc = 0.0f;
uint16_t minAdc = 1023;
uint16_t maxAdc = 0;
uint32_t maxLatenessUs = 0;
float filteredCounts = 0.0f;
bool filterInitialized = false;

uint16_t quantize10(uint16_t raw10, uint8_t bits) {
  const uint16_t levels = (1U << bits) - 1U;
  return (uint16_t)(((uint32_t)raw10 * levels + 511UL) / 1023UL);
}

float reconstructCounts(uint16_t q, uint8_t bits) {
  const uint16_t levels = (1U << bits) - 1U;
  return ((float)q * 1023.0f) / (float)levels;
}

uint8_t toPwm8(uint16_t raw10) {
  return (uint8_t)(((uint32_t)raw10 * 255UL + 511UL) / 1023UL);
}

void resetWindow() {
  windowCount = 0;
  meanAdc = 0.0f;
  m2Adc = 0.0f;
  minAdc = 1023;
  maxAdc = 0;
  maxLatenessUs = 0;
}

void setup() {
  Serial.begin(BAUD);
  pinMode(ANALOG_PIN, INPUT);
  pinMode(PWM_PIN, OUTPUT);
  nextSampleUs = micros();
  Serial.println("NUMERIC_ERROR_SIGNAL_CHAIN_V1");
  Serial.println("sample_us,scheduled_us,lateness_us,dt_us,raw10,nominal_voltage_v,q8,recon8,error8_counts,q6,recon6,error6_counts,q4,recon4,error4_counts,ema_counts,ema_residual_counts,pwm8,pwm_duty,reconstructed_pwm10,pwm_error_counts,window_samples,window_mean_adc,window_stddev_adc,window_peak_to_peak_adc,window_max_lateness_us");
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
  if (latenessUs > maxLatenessUs) maxLatenessUs = latenessUs;

  const uint16_t raw = analogRead(ANALOG_PIN);
  const float nominalVoltage = (float)raw * NOMINAL_VREF_V / 1023.0f;

  const uint16_t q8 = quantize10(raw, 8);
  const uint16_t q6 = quantize10(raw, 6);
  const uint16_t q4 = quantize10(raw, 4);
  const float recon8 = reconstructCounts(q8, 8);
  const float recon6 = reconstructCounts(q6, 6);
  const float recon4 = reconstructCounts(q4, 4);

  if (!filterInitialized) {
    filteredCounts = (float)raw;
    filterInitialized = true;
  } else {
    filteredCounts += EMA_ALPHA * ((float)raw - filteredCounts);
  }

  const uint8_t pwm = toPwm8(raw);
  analogWrite(PWM_PIN, pwm);
  const float pwmDuty = (float)pwm / 255.0f;
  const float pwmRecon10 = (float)pwm * 1023.0f / 255.0f;

  windowCount++;
  const float delta = (float)raw - meanAdc;
  meanAdc += delta / (float)windowCount;
  const float delta2 = (float)raw - meanAdc;
  m2Adc += delta * delta2;
  if (raw < minAdc) minAdc = raw;
  if (raw > maxAdc) maxAdc = raw;

  const bool windowComplete = windowCount >= WINDOW_SAMPLES;
  const float windowStddev = windowComplete ? sqrtf(m2Adc / (float)windowCount) : -1.0f;
  const uint16_t windowP2P = windowComplete ? (uint16_t)(maxAdc - minAdc) : 0;
  const uint16_t reportWindowCount = windowComplete ? windowCount : 0;
  const float reportWindowMean = windowComplete ? meanAdc : -1.0f;
  const uint32_t reportMaxLateness = windowComplete ? maxLatenessUs : 0;

  Serial.print(sampleUs); Serial.print(',');
  Serial.print(scheduledUs); Serial.print(',');
  Serial.print(latenessUs); Serial.print(',');
  Serial.print(dtUs); Serial.print(',');
  Serial.print(raw); Serial.print(',');
  Serial.print(nominalVoltage, 7); Serial.print(',');
  Serial.print(q8); Serial.print(','); Serial.print(recon8, 5); Serial.print(','); Serial.print(recon8 - raw, 5); Serial.print(',');
  Serial.print(q6); Serial.print(','); Serial.print(recon6, 5); Serial.print(','); Serial.print(recon6 - raw, 5); Serial.print(',');
  Serial.print(q4); Serial.print(','); Serial.print(recon4, 5); Serial.print(','); Serial.print(recon4 - raw, 5); Serial.print(',');
  Serial.print(filteredCounts, 5); Serial.print(','); Serial.print(filteredCounts - raw, 5); Serial.print(',');
  Serial.print(pwm); Serial.print(','); Serial.print(pwmDuty, 8); Serial.print(',');
  Serial.print(pwmRecon10, 5); Serial.print(','); Serial.print(pwmRecon10 - raw, 5); Serial.print(',');
  Serial.print(reportWindowCount); Serial.print(','); Serial.print(reportWindowMean, 5); Serial.print(',');
  Serial.print(windowStddev, 5); Serial.print(','); Serial.print(windowP2P); Serial.print(',');
  Serial.println(reportMaxLateness);

  if (windowComplete) resetWindow();
}
