#include "PeakHold.h"

namespace betterboard {
namespace signal {

PeakHold::PeakHold() { reset(); }

void PeakHold::reset() {
    peak_ = 0.0;
    initialized_ = false;
}

double PeakHold::push(double sample) {
    if (!initialized_ || sample > peak_) {
        peak_ = sample;
        initialized_ = true;
    }
    return peak_;
}

bool PeakHold::initialized() const { return initialized_; }
double PeakHold::peak() const { return peak_; }

}  // namespace signal
}  // namespace betterboard
