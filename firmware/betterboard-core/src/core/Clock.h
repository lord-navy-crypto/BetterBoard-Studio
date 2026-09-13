#pragma once

#include <stdint.h>

namespace betterboard {
namespace core {

// Portable clock boundary for deterministic acquisition tests.
class IClock {
 public:
  virtual ~IClock() = default;
  virtual uint32_t micros() const = 0;
};

// Native-test clock. No Arduino dependency and no heap allocation.
class ManualClock : public IClock {
 public:
  explicit ManualClock(uint32_t now_us = 0U) : now_us_(now_us) {}

  uint32_t micros() const override { return now_us_; }
  void setMicros(uint32_t now_us) { now_us_ = now_us; }
  void advanceMicros(uint32_t delta_us) { now_us_ += delta_us; }

 private:
  uint32_t now_us_;
};

}  // namespace core
}  // namespace betterboard
