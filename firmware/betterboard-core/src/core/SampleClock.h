#pragma once

#include <stdint.h>

namespace betterboard {
namespace core {

struct SampleTiming {
  uint32_t timestamp_us{0U};
  uint32_t sample_dt_us{0U};
  uint32_t lateness_us{0U};
  bool late{false};
};

// Tracks actual sample spacing and lateness without owning a hardware clock.
class SampleClock {
 public:
  explicit SampleClock(uint32_t requested_period_us = 10000U,
                       uint8_t late_numerator = 3U,
                       uint8_t late_denominator = 2U)
      : requested_period_us_(requested_period_us == 0U ? 1U : requested_period_us),
        late_numerator_(late_numerator == 0U ? 1U : late_numerator),
        late_denominator_(late_denominator == 0U ? 1U : late_denominator),
        previous_timestamp_us_(0U),
        has_previous_(false) {}

  SampleTiming observe(uint32_t timestamp_us) {
    SampleTiming timing;
    timing.timestamp_us = timestamp_us;

    if (!has_previous_) {
      previous_timestamp_us_ = timestamp_us;
      has_previous_ = true;
      return timing;
    }

    timing.sample_dt_us = timestamp_us - previous_timestamp_us_;
    previous_timestamp_us_ = timestamp_us;

    const uint64_t threshold =
        (static_cast<uint64_t>(requested_period_us_) * late_numerator_) /
        late_denominator_;
    timing.late = static_cast<uint64_t>(timing.sample_dt_us) > threshold;
    if (timing.sample_dt_us > requested_period_us_) {
      timing.lateness_us = timing.sample_dt_us - requested_period_us_;
    }
    return timing;
  }

  void reset() {
    previous_timestamp_us_ = 0U;
    has_previous_ = false;
  }

  uint32_t requestedPeriodMicros() const { return requested_period_us_; }

 private:
  uint32_t requested_period_us_;
  uint8_t late_numerator_;
  uint8_t late_denominator_;
  uint32_t previous_timestamp_us_;
  bool has_previous_;
};

}  // namespace core
}  // namespace betterboard
