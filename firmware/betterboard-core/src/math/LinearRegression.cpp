#include "LinearRegression.h"

namespace betterboard {
namespace math {

LinearRegression::LinearRegression() { reset(); }

void LinearRegression::reset() {
    count_ = 0U;
    sum_x_ = 0.0;
    sum_y_ = 0.0;
    sum_xx_ = 0.0;
    sum_yy_ = 0.0;
    sum_xy_ = 0.0;
}

void LinearRegression::push(double x, double y) {
    ++count_;
    sum_x_ += x;
    sum_y_ += y;
    sum_xx_ += x * x;
    sum_yy_ += y * y;
    sum_xy_ += x * y;
}

uint32_t LinearRegression::count() const { return count_; }

bool LinearRegression::valid() const {
    if (count_ < 2U) return false;
    const double n = static_cast<double>(count_);
    return (n * sum_xx_ - sum_x_ * sum_x_) != 0.0;
}

double LinearRegression::slope() const {
    if (!valid()) return 0.0;
    const double n = static_cast<double>(count_);
    return (n * sum_xy_ - sum_x_ * sum_y_) / (n * sum_xx_ - sum_x_ * sum_x_);
}

double LinearRegression::intercept() const {
    if (!valid()) return 0.0;
    return (sum_y_ - slope() * sum_x_) / static_cast<double>(count_);
}

double LinearRegression::rSquared() const {
    if (!valid()) return 0.0;
    const double n = static_cast<double>(count_);
    const double numerator = n * sum_xy_ - sum_x_ * sum_y_;
    const double dx = n * sum_xx_ - sum_x_ * sum_x_;
    const double dy = n * sum_yy_ - sum_y_ * sum_y_;
    if (dx <= 0.0 || dy <= 0.0) return 0.0;
    return (numerator * numerator) / (dx * dy);
}

}  // namespace math
}  // namespace betterboard
