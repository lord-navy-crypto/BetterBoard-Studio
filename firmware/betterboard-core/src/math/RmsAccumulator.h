#pragma once

#include <stdint.h>

namespace betterboard {
namespace math {

class RmsAccumulator {
public:
    RmsAccumulator();

    void reset();
    void push(double value);
    uint32_t count() const;
    double meanSquare() const;
    double rms() const;

private:
    uint32_t count_;
    double sum_squares_;
};

}  // namespace math
}  // namespace betterboard
