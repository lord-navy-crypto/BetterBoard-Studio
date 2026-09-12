#pragma once

#include <stdint.h>

namespace betterboard {
namespace measurement {

template <typename T>
struct Sample {
    uint32_t timestampUs = 0U;
    T value{};
    bool valid = false;
};

}  // namespace measurement
}  // namespace betterboard
