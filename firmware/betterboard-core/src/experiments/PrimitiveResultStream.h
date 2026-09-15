#pragma once

#include <Arduino.h>

namespace betterboard {
namespace experiments {

// Metadata-style side channel for MCU-derived primitive results.
// Raw EngineeringLabStream CSV rows remain unchanged.
class PrimitiveResultStream {
 public:
  explicit PrimitiveResultStream(Print& output);

  void value(const char* kind,
             const char* source,
             uint32_t time_us,
             double value,
             const char* parameter_key = nullptr,
             const char* parameter_value = nullptr,
             int digits = 6);

  void state(const char* kind,
             const char* source,
             uint32_t time_us,
             bool state,
             const char* parameter_key = nullptr,
             const char* parameter_value = nullptr);

 private:
  void prefix(const char* kind, const char* source, uint32_t time_us);
  void parameters(const char* parameter_key, const char* parameter_value);

  Print& output_;
};

}  // namespace experiments
}  // namespace betterboard
