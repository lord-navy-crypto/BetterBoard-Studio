#include "ExponentialMovingAverage.h"

namespace betterboard {
namespace signal {

ExponentialMovingAverage::ExponentialMovingAverage(double alpha)
    : alpha_(0.2), value_(0.0), initialized_(false) {
    setAlpha(alpha);
}

void ExponentialMovingAverage::setAlpha(double alpha) {
    if (alpha < 0.0) alpha = 0.0;
    if (alpha > 1.0) alpha = 1.0;
    alpha_ = alpha;
}

void ExponentialMovingAverage::reset() {
    value_ = 0.0;
    initialized_ = false;
}

double ExponentialMovingAverage::push(double sample) {
    if (!initialized_) {
        value_ = sample;
        initialized_ = true;
    } else {
        value_ = alpha_ * sample + (1.0 - alpha_) * value_;
    }
    return value_;
}

bool ExponentialMovingAverage::initialized() const { return initialized_; }
double ExponentialMovingAverage::value() const { return value_; }

}  // namespace signal
}  // namespace betterboard
