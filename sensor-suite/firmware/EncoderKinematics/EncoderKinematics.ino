#include <BetterBoard.h>

#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;
volatile long encoder_count = 0;

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::FiniteDifference angle_rate;
betterboard::math::FiniteDifference omega_rate;

void onEncoderA() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a == b) ? 1 : -1;
}

void setup() {
  Serial.begin(115200);
  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEncoderA, CHANGE);
  sampler.reset(micros());
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  noInterrupts();
  const long count = encoder_count;
  interrupts();

  const double time_s = static_cast<double>(now) * 1.0e-6;
  const double angle_rad = (2.0 * 3.14159265358979323846 * static_cast<double>(count)) /
                           static_cast<double>(BB_COUNTS_PER_REVOLUTION);

  double omega = 0.0;
  double alpha = 0.0;
  if (angle_rate.push(time_s, angle_rad)) {
    omega = angle_rate.derivative();
    if (omega_rate.push(time_s, omega)) alpha = omega_rate.derivative();
  }

  Serial.print(now); Serial.print(',');
  Serial.print(count); Serial.print(',');
  Serial.print(angle_rad, 7); Serial.print(',');
  Serial.print(omega, 7); Serial.print(',');
  Serial.println(alpha, 7);
}
