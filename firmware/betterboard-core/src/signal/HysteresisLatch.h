#pragma once

namespace betterboard {
namespace signal {

class HysteresisLatch {
public:
    HysteresisLatch(double low_threshold, double high_threshold);

    void reset(bool state = false);
    bool update(double value);
    bool state() const;

private:
    double low_threshold_;
    double high_threshold_;
    bool state_;
};

}  // namespace signal
}  // namespace betterboard
