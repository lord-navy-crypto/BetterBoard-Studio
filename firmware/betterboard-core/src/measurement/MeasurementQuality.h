#pragma once

#include <stdint.h>

namespace betterboard {
namespace measurement {

enum class Quality : uint8_t {
    Valid = 0,
    WarmingUp = 1,
    OutOfRange = 2,
    SensorError = 3,
    TimingInvalid = 4,
    CalibrationMissing = 5
};

inline bool isUsable(Quality quality) {
    return quality == Quality::Valid || quality == Quality::CalibrationMissing;
}

}  // namespace measurement
}  // namespace betterboard
