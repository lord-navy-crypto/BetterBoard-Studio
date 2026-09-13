#include <HX711.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0L
#define BB_OFFSET_COUNTS_DEFAULT 1
#else
#define BB_OFFSET_COUNTS_DEFAULT 0
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0f
#define BB_COUNTS_PER_NEWTON_DEFAULT 1
#else
#define BB_COUNTS_PER_NEWTON_DEFAULT 0
#endif
#ifndef BB_FILTER_ALPHA
#define BB_FILTER_ALPHA 0.2f
#endif

#define BB_STRINGIFY_INNER(x) #x
#define BB_STRINGIFY(x) BB_STRINGIFY_INNER(x)

HX711 scale;
const uint8_t HX_DOUT = 4;
const uint8_t HX_SCK = 5;

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::signal::ExponentialMovingAverage filter(BB_FILTER_ALPHA);
betterboard::math::FiniteDifference force_rate;
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0U;

void setup() {
  Serial.begin(115200);
  scale.begin(HX_DOUT, HX_SCK);
  sampler.arm(micros());
  stream.begin("el-force-dynamics-hx711",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,raw_counts,force_n,filtered_force_n,dfdt_nps,sample_dt_us,read_duration_us,quality_flags",
               "us,count,N,N,N/s,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;offset_counts=" BB_STRINGIFY(BB_OFFSET_COUNTS) ";counts_per_newton=" BB_STRINGIFY(BB_COUNTS_PER_NEWTON) ";filter_alpha=" BB_STRINGIFY(BB_FILTER_ALPHA));
}

void loop() {
  const uint32_t now = micros();
  if (!sampler.ready(now) || !scale.is_ready()) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t base_quality = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    base_quality = betterboard::experiments::evidence::addFlag(
        base_quality, betterboard::experiments::evidence::TimingLate);
  }
#if BB_OFFSET_COUNTS_DEFAULT || BB_COUNTS_PER_NEWTON_DEFAULT
  base_quality = betterboard::experiments::evidence::addFlag(
      base_quality, betterboard::experiments::evidence::CalibrationDefault);
#endif

  const uint32_t read_start_us = micros();
  const long raw = scale.read();
  const uint32_t read_duration_us = micros() - read_start_us;
  const betterboard::measurement::AcquisitionResult<long> result =
      betterboard::measurement::AcquisitionResult<long>::success(
          raw, now, read_duration_us);
  betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          sequence_id++, timing.sample_dt_us, result, base_quality);

  const double force_n = (raw - long(BB_OFFSET_COUNTS)) / double(BB_COUNTS_PER_NEWTON);
  const double filtered = filter.push(force_n);
  double dfdt = 0.0;
  if (!force_rate.push(now * 1.0e-6, filtered)) {
    record.quality_flags = betterboard::experiments::evidence::addFlag(
        record.quality_flags, betterboard::experiments::evidence::DerivedUnavailable);
  } else {
    dfdt = force_rate.derivative();
  }

  stream.rowBegin(record.timestamp_us);
  stream.field(raw); stream.field(force_n, 6); stream.field(filtered, 6); stream.field(dfdt, 6);
  stream.field(record.sample_dt_us); stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
