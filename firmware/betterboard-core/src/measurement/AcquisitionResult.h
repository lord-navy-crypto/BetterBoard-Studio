#pragma once

#include <stdint.h>

namespace betterboard {
namespace measurement {

enum class AcquisitionStatus : uint8_t {
  Ok = 0,
  NotReady,
  Timeout,
  BusError,
  InvalidValue,
  Saturated
};

template <typename T>
struct AcquisitionResult {
  T value{};
  AcquisitionStatus status{AcquisitionStatus::NotReady};
  uint32_t timestamp_us{0U};
  uint32_t read_duration_us{0U};

  bool ok() const { return status == AcquisitionStatus::Ok; }

  static AcquisitionResult success(const T& sample,
                                   uint32_t timestamp,
                                   uint32_t read_duration = 0U) {
    AcquisitionResult result;
    result.value = sample;
    result.status = AcquisitionStatus::Ok;
    result.timestamp_us = timestamp;
    result.read_duration_us = read_duration;
    return result;
  }

  static AcquisitionResult failure(AcquisitionStatus failure_status,
                                   uint32_t timestamp,
                                   uint32_t read_duration = 0U) {
    AcquisitionResult result;
    result.status = failure_status;
    result.timestamp_us = timestamp;
    result.read_duration_us = read_duration;
    return result;
  }
};

}  // namespace measurement
}  // namespace betterboard
