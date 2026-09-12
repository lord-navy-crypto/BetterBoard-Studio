#include "ThresholdTrigger.h"

namespace betterboard {
namespace signal {

ThresholdTrigger::ThresholdTrigger(double threshold) : threshold_(threshold), latched_(false) {}
void ThresholdTrigger::reset() { latched_ = false; }
void ThresholdTrigger::setThreshold(double threshold) { threshold_ = threshold; }
double ThresholdTrigger::threshold() const { return threshold_; }
bool ThresholdTrigger::update(double value) {
    if (!latched_ && value >= threshold_) latched_ = true;
    return latched_;
}
bool ThresholdTrigger::latched() const { return latched_; }

}  // namespace signal
}  // namespace betterboard
