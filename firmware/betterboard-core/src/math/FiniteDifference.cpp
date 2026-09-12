#include "FiniteDifference.h"

namespace betterboard {
namespace math {

FiniteDifference::FiniteDifference() { reset(); }

void FiniteDifference::reset() {
    previous_time_ = 0.0;
    previous_sample_ = 0.0;
    derivative_ = 0.0;
    initialized_ = false;
    derivative_valid_ = false;
}

bool FiniteDifference::push(double time_seconds, double sample) {
    if (!initialized_) {
        previous_time_ = time_seconds;
        previous_sample_ = sample;
        initialized_ = true;
        derivative_valid_ = false;
        return false;
    }

    const double dt = time_seconds - previous_time_;
    if (dt <= 0.0) {
        derivative_valid_ = false;
        return false;
    }

    derivative_ = (sample - previous_sample_) / dt;
    previous_time_ = time_seconds;
    previous_sample_ = sample;
    derivative_valid_ = true;
    return true;
}

bool FiniteDifference::hasDerivative() const { return derivative_valid_; }
double FiniteDifference::derivative() const { return derivative_; }

}  // namespace math
}  // namespace betterboard
