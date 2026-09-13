#pragma once

#include "Clock.h"

#ifdef ARDUINO
#include <Arduino.h>

namespace betterboard {
namespace core {

class ArduinoClock : public IClock {
 public:
  uint32_t micros() const override { return static_cast<uint32_t>(::micros()); }
};

}  // namespace core
}  // namespace betterboard
#endif
