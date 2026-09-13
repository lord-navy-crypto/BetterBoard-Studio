#pragma once

#include <stdint.h>

namespace betterboard {
namespace experiments {
namespace evidence {

// Compact, composable evidence-quality flags for Engineering Lab streams.
// Zero means no known quality issue for the emitted row.
enum QualityFlag : uint16_t {
  Valid = 0,
  SensorNotReady = 1u << 0,
  SensorError = 1u << 1,
  TimingLate = 1u << 2,
  CalibrationDefault = 1u << 3,
  Saturated = 1u << 4,
  WarmingUp = 1u << 5,
  DerivedUnavailable = 1u << 6
};

inline uint16_t addFlag(uint16_t flags, QualityFlag flag) {
  return static_cast<uint16_t>(flags | static_cast<uint16_t>(flag));
}

inline bool hasFlag(uint16_t flags, QualityFlag flag) {
  return (flags & static_cast<uint16_t>(flag)) != 0;
}

}  // namespace evidence
}  // namespace experiments
}  // namespace betterboard
