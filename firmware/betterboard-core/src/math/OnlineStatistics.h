#pragma once

#include <stdint.h>

namespace betterboard {
namespace math {

class OnlineStatistics {
public:
    OnlineStatistics();

    void reset();
    void push(double value);

    uint32_t count() const;
    double mean() const;
    double variancePopulation() const;
    double varianceSample() const;
    double standardDeviationPopulation() const;
    double standardDeviationSample() const;
    double minimum() const;
    double maximum() const;
    double peakToPeak() const;

private:
    uint32_t count_;
    double mean_;
    double m2_;
    double min_;
    double max_;
};

}  // namespace math
}  // namespace betterboard
