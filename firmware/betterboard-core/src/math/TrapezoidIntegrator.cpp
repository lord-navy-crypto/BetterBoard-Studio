#include "TrapezoidIntegrator.h"

namespace betterboard {
namespace math {

TrapezoidIntegrator::TrapezoidIntegrator() { reset(); }

void TrapezoidIntegrator::reset(double initial_value) {
    integral_ = initial_value;
    previous_time_ = 0.0;
    previous_sample_ = 0.0;
    initialized_ = false;
}

bool TrapezoidIntegrator::push(double time_seconds, double sample) {
    if (!initialized_) {
        previous_time_ = time_seconds;
        previous_sample_ = sample;
        initialized_ = true;
        return false;
    }

    const double dt = time_seconds - previous_time_;
    if (dt <= 0.0) {
        return false;
    }

    integral_ += 0.5 * (previous_sample_ + sample) * dt;
    previous_time_ = time_seconds;
    previous_sample_ = sample;
    return true;
}

double TrapezoidIntegrator::value() const { return integral_; }
bool TrapezoidIntegrator::initialized() const { return initialized_; }

}  // namespace math
}  // namespace betterboard
