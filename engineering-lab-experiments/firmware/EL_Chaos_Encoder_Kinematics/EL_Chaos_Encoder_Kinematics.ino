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
betterboard::math::FiniteDifference omega_diff;
betterboard::math::FiniteDifference alpha_diff;
betterboard::experiments::EngineeringLabStream stream(Serial);

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
  sampler.arm(micros());
  stream.begin("el-chaos-encoder-kinematics",
               betterboard::experiments::target::NONLINEAR_DYNAMICS_CHAOS,
               "time_us,count,angle_rad,omega_rps,alpha_rps2",
               "us,count,rad,rad/s,rad/s^2",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  noInterrupts();
  const long count = encoder_count;
  interrupts();

  const double t = now * 1.0e-6;
  const double angle = (2.0 * 3.14159265358979323846 * count) / double(BB_COUNTS_PER_REVOLUTION);
  double omega = 0.0;
  double alpha = 0.0;
  if (omega_diff.push(t, angle)) {
    omega = omega_diff.derivative();
    if (alpha_diff.push(t, omega)) alpha = alpha_diff.derivative();
  }

  stream.rowBegin(now);
  stream.field(count); stream.field(angle, 7); stream.field(omega, 7); stream.field(alpha, 7);
  stream.rowEnd();
}
