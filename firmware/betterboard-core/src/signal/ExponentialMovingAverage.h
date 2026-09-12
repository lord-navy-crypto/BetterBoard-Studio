#pragma once

namespace betterboard {
namespace signal {

class ExponentialMovingAverage {
public:
    explicit ExponentialMovingAverage(double alpha = 0.2);

    void setAlpha(double alpha);
    void reset();
    double push(double sample);
    bool initialized() const;
    double value() const;

private:
    double alpha_;
    double value_;
    bool initialized_;
};

}  // namespace signal
}  // namespace betterboard
