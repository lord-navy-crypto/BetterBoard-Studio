#include "RmsAccumulator.h"

#include <math.h>

namespace betterboard {
namespace math {

RmsAccumulator::RmsAccumulator() { reset(); }
void RmsAccumulator::reset() { count_ = 0U; sum_squares_ = 0.0; }
void RmsAccumulator::push(double value) { ++count_; sum_squares_ += value * value; }
uint32_t RmsAccumulator::count() const { return count_; }
double RmsAccumulator::meanSquare() const { return count_ == 0U ? 0.0 : sum_squares_ / static_cast<double>(count_); }
double RmsAccumulator::rms() const { return sqrt(meanSquare()); }

}  // namespace math
}  // namespace betterboard
