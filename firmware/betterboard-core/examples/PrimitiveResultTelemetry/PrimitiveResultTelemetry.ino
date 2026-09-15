#include <BetterBoard.h>

using namespace betterboard;

experiments::PrimitiveResultStream primitive_stream(Serial);
math::OnlineStatistics stats;
math::RmsAccumulator rms;
math::FiniteDifference derivative;
math::TrapezoidIntegrator integral;
signal::ExponentialMovingAverage ema(0.5);
signal::PeakHold peak_hold;
signal::ThresholdTrigger threshold(3.0);
signal::HysteresisLatch hysteresis(1.0, 4.0);

static const uint32_t kTimeUs[] = {0UL, 1000000UL, 3000000UL};
static const double kValues[] = {0.0, 2.0, 6.0};
static const size_t kCount = sizeof(kValues) / sizeof(kValues[0]);
static const char* kSource = "signal";

void setup() {
  Serial.begin(115200);

  for (size_t i = 0; i < kCount; ++i) {
    const uint32_t time_us = kTimeUs[i];
    const double time_s = static_cast<double>(time_us) / 1000000.0;
    const double sample = kValues[i];

    stats.push(sample);
    rms.push(sample);
    derivative.push(time_s, sample);
    integral.push(time_s, sample);
    const double ema_value = ema.push(sample);
    const double peak_value = peak_hold.push(sample);
    const bool threshold_state = threshold.update(sample);
    const bool hysteresis_state = hysteresis.update(sample);

    primitive_stream.value("stats_mean", kSource, time_us, stats.mean());
    primitive_stream.value("stats_std", kSource, time_us, stats.standardDeviationSample());
    primitive_stream.value("stats_min", kSource, time_us, stats.minimum());
    primitive_stream.value("stats_max", kSource, time_us, stats.maximum());
    primitive_stream.value("rms", kSource, time_us, rms.rms());
    if (derivative.hasDerivative()) {
      primitive_stream.value("derivative", kSource, time_us, derivative.derivative());
    }
    primitive_stream.value("integral", kSource, time_us, integral.value());
    primitive_stream.value("ema", kSource, time_us, ema_value, "alpha", "0.5");
    primitive_stream.value("peak_hold", kSource, time_us, peak_value);
    primitive_stream.state("threshold", kSource, time_us, threshold_state, "threshold", "3");
    primitive_stream.state("hysteresis", kSource, time_us, hysteresis_state, "low_high", "1|4");
  }
}

void loop() {}
