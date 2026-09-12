#include "HysteresisLatch.h"

namespace betterboard {
namespace signal {

HysteresisLatch::HysteresisLatch(double low_threshold, double high_threshold)
    : low_threshold_(low_threshold), high_threshold_(high_threshold), state_(false) {
    if (low_threshold_ > high_threshold_) {
        const double tmp = low_threshold_;
        low_threshold_ = high_threshold_;
        high_threshold_ = tmp;
    }
}

void HysteresisLatch::reset(bool state) { state_ = state; }

bool HysteresisLatch::update(double value) {
    if (!state_ && value >= high_threshold_) state_ = true;
    else if (state_ && value <= low_threshold_) state_ = false;
    return state_;
}

bool HysteresisLatch::state() const { return state_; }

}  // namespace signal
}  // namespace betterboard
