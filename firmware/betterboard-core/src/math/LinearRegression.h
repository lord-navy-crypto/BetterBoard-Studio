#pragma once

#include <stdint.h>

namespace betterboard {
namespace math {

class LinearRegression {
public:
    LinearRegression();

    void reset();
    void push(double x, double y);

    uint32_t count() const;
    bool valid() const;
    double slope() const;
    double intercept() const;
    double rSquared() const;

private:
    uint32_t count_;
    double sum_x_;
    double sum_y_;
    double sum_xx_;
    double sum_yy_;
    double sum_xy_;
};

}  // namespace math
}  // namespace betterboard
