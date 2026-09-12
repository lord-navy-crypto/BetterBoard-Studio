#include "OnlineStatistics.h"

#include <math.h>

namespace betterboard {
namespace math {

OnlineStatistics::OnlineStatistics() { reset(); }

void OnlineStatistics::reset() {
    count_ = 0U;
    mean_ = 0.0;
    m2_ = 0.0;
    min_ = 0.0;
    max_ = 0.0;
}

void OnlineStatistics::push(double value) {
    ++count_;
    if (count_ == 1U) {
        mean_ = value;
        min_ = value;
        max_ = value;
        return;
    }

    if (value < min_) min_ = value;
    if (value > max_) max_ = value;

    const double delta = value - mean_;
    mean_ += delta / static_cast<double>(count_);
    const double delta2 = value - mean_;
    m2_ += delta * delta2;
}

uint32_t OnlineStatistics::count() const { return count_; }
double OnlineStatistics::mean() const { return count_ == 0U ? 0.0 : mean_; }
double OnlineStatistics::variancePopulation() const { return count_ == 0U ? 0.0 : m2_ / static_cast<double>(count_); }
double OnlineStatistics::varianceSample() const { return count_ < 2U ? 0.0 : m2_ / static_cast<double>(count_ - 1U); }
double OnlineStatistics::standardDeviationPopulation() const { return sqrt(variancePopulation()); }
double OnlineStatistics::standardDeviationSample() const { return sqrt(varianceSample()); }
double OnlineStatistics::minimum() const { return count_ == 0U ? 0.0 : min_; }
double OnlineStatistics::maximum() const { return count_ == 0U ? 0.0 : max_; }
double OnlineStatistics::peakToPeak() const { return count_ == 0U ? 0.0 : max_ - min_; }

}  // namespace math
}  // namespace betterboard
