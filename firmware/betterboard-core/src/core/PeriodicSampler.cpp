#include "PeriodicSampler.h"

namespace betterboard {
namespace core {

PeriodicSampler::PeriodicSampler(uint32_t period_us)
    : period_us_(period_us == 0U ? 1U : period_us), next_due_us_(0U), armed_(false) {}

void PeriodicSampler::setPeriodMicros(uint32_t period_us) {
    period_us_ = period_us == 0U ? 1U : period_us;
}

uint32_t PeriodicSampler::periodMicros() const {
    return period_us_;
}

void PeriodicSampler::reset(uint32_t now_us) {
    next_due_us_ = now_us + period_us_;
    armed_ = true;
}

bool PeriodicSampler::ready(uint32_t now_us) {
    if (!armed_) {
        reset(now_us);
        return true;
    }

    if (static_cast<int32_t>(now_us - next_due_us_) < 0) {
        return false;
    }

    do {
        next_due_us_ += period_us_;
    } while (static_cast<int32_t>(now_us - next_due_us_) >= 0);

    return true;
}

}  // namespace core
}  // namespace betterboard
