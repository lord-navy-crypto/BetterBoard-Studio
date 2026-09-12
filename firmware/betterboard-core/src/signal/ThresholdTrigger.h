#pragma once

namespace betterboard {
namespace signal {

class ThresholdTrigger {
public:
    explicit ThresholdTrigger(double threshold);

    void reset();
    void setThreshold(double threshold);
    double threshold() const;
    bool update(double value);
    bool latched() const;

private:
    double threshold_;
    bool latched_;
};

}  // namespace signal
}  // namespace betterboard
