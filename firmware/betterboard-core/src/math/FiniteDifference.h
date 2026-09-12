#pragma once

namespace betterboard {
namespace math {

class FiniteDifference {
public:
    FiniteDifference();

    void reset();
    bool push(double time_seconds, double sample);
    bool hasDerivative() const;
    double derivative() const;

private:
    double previous_time_;
    double previous_sample_;
    double derivative_;
    bool initialized_;
    bool derivative_valid_;
};

}  // namespace math
}  // namespace betterboard
