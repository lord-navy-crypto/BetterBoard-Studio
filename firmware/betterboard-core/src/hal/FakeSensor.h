#pragma once

#include <stddef.h>
#include <stdint.h>

#include "SensorAdapter.h"

namespace betterboard {
namespace hal {

template <typename T, size_t Capacity>
class FakeSensor : public ISensorAdapter<T> {
 public:
  FakeSensor() : count_(0U), index_(0U) {}

  bool push(const measurement::AcquisitionResult<T>& result) {
    if (count_ >= Capacity) return false;
    script_[count_++] = result;
    return true;
  }

  bool empty() const { return index_ >= count_; }
  size_t remaining() const { return index_ < count_ ? count_ - index_ : 0U; }

  measurement::AcquisitionResult<T> read() {
    if (empty()) {
      return measurement::AcquisitionResult<T>::failure(
          measurement::AcquisitionStatus::NotReady, 0U, 0U);
    }
    return script_[index_++];
  }

  measurement::AcquisitionResult<T> readAt(uint32_t timestamp_us) override {
    measurement::AcquisitionResult<T> result = read();
    result.timestamp_us = timestamp_us;
    return result;
  }

  void reset() { index_ = 0U; }

 private:
  measurement::AcquisitionResult<T> script_[Capacity]{};
  size_t count_;
  size_t index_;
};

}  // namespace hal
}  // namespace betterboard
