#pragma once

#include <stdint.h>

#include "../core/Clock.h"
#include "../measurement/AcquisitionResult.h"

namespace betterboard {
namespace hal {

template <typename T>
class ISensorAdapter {
 public:
  virtual ~ISensorAdapter() = default;
  virtual measurement::AcquisitionResult<T> readAt(uint32_t timestamp_us) = 0;
};

template <typename T>
class ClockedSensorAdapter : public ISensorAdapter<T> {
 public:
  using Reader = measurement::AcquisitionStatus (*)(void*, T&);

  ClockedSensorAdapter(core::IClock& clock, void* context, Reader reader)
      : clock_(clock), context_(context), reader_(reader) {}

  measurement::AcquisitionResult<T> readAt(uint32_t timestamp_us) override {
    T value{};
    const uint32_t start_us = clock_.micros();
    const measurement::AcquisitionStatus status = reader_(context_, value);
    const uint32_t duration_us = clock_.micros() - start_us;
    if (status == measurement::AcquisitionStatus::Ok) {
      return measurement::AcquisitionResult<T>::success(value, timestamp_us, duration_us);
    }
    return measurement::AcquisitionResult<T>::failure(status, timestamp_us, duration_us);
  }

 private:
  core::IClock& clock_;
  void* context_;
  Reader reader_;
};

}  // namespace hal
}  // namespace betterboard
