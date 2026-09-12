#pragma once

namespace betterboard {
namespace math {

class TrapezoidIntegrator {
public:
    TrapezoidIntegrator();

    void reset(double initial_value = 0.0);
    bool push(double time_seconds, double sample);
    double value() const;
    bool initialized() const;

private:
    double integral_;
    double previous_time_;
    double previous_sample_;
    bool initialized_;
};

}  // namespace math
}  // namespace betterboard
