#include <BetterBoard.h>
#include <math.h>

#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#define BB_COUNTS_PER_REVOLUTION_DEFAULT 1
#else
#define BB_COUNTS_PER_REVOLUTION_DEFAULT 0
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

#define BB_STRINGIFY_INNER(x) #x
#define BB_STRINGIFY(x) BB_STRINGIFY_INNER(x)

const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;
volatile long encoder_count = 0;

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::math::FiniteDifference omega_diff;
betterboard::math::FiniteDifference alpha_diff;
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0U;

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
               "time_us,count,angle_rad,omega_rps,alpha_rps2,revolutions,phase_rad,sample_dt_us,read_duration_us,quality_flags",
               "us,count,rad,rad/s,rad/s^2,rev,rad,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;encoder=quadrature;counts_per_revolution=" BB_STRINGIFY(BB_COUNTS_PER_REVOLUTION));
}

void loop() {
  const uint32_t now = micros();
  if (!sampler.ready(now)) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t base_quality = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    base_quality = betterboard::experiments::evidence::addFlag(
        base_quality, betterboard::experiments::evidence::TimingLate);
  }
#if BB_COUNTS_PER_REVOLUTION_DEFAULT
  base_quality = betterboard::experiments::evidence::addFlag(
      base_quality, betterboard::experiments::evidence::CalibrationDefault);
#endif

  const uint32_t read_start_us = micros();
  noInterrupts();
  const long count = encoder_count;
  interrupts();
  const uint32_t read_duration_us = micros() - read_start_us;

  const betterboard::measurement::AcquisitionResult<long> result =
      betterboard::measurement::AcquisitionResult<long>::success(
          count, now, read_duration_us);
  betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          sequence_id++, timing.sample_dt_us, result, base_quality);

  const double t = now * 1.0e-6;
  const double revolutions = count / double(BB_COUNTS_PER_REVOLUTION);
  const double angle = 2.0 * 3.14159265358979323846 * revolutions;
  double phase = fmod(angle, 2.0 * 3.14159265358979323846);
  if (phase < 0.0) phase += 2.0 * 3.14159265358979323846;
  double omega = 0.0;
  double alpha = 0.0;
  bool derivative_ready = false;
  if (omega_diff.push(t, angle)) {
    omega = omega_diff.derivative();
    if (alpha_diff.push(t, omega)) {
      alpha = alpha_diff.derivative();
      derivative_ready = true;
    }
  }
  if (!derivative_ready) {
    record.quality_flags = betterboard::experiments::evidence::addFlag(
        record.quality_flags, betterboard::experiments::evidence::DerivedUnavailable);
  }

  stream.rowBegin(record.timestamp_us);
  stream.field(count); stream.field(angle, 7); stream.field(omega, 7); stream.field(alpha, 7);
  stream.field(revolutions, 7); stream.field(phase, 7);
  stream.field(record.sample_dt_us); stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
