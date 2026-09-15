#include "PrimitiveResultStream.h"

namespace betterboard {
namespace experiments {

PrimitiveResultStream::PrimitiveResultStream(Print& output) : output_(output) {}

void PrimitiveResultStream::prefix(const char* kind, const char* source, uint32_t time_us) {
  output_.print(F("#BB_PRIMITIVE,1,"));
  output_.print(kind != nullptr ? kind : "");
  output_.print(',');
  output_.print(source != nullptr ? source : "");
  output_.print(',');
  output_.print(time_us);
  output_.print(',');
}

void PrimitiveResultStream::parameters(const char* parameter_key, const char* parameter_value) {
  output_.print(',');
  if (parameter_key != nullptr && parameter_value != nullptr) {
    output_.print(parameter_key);
    output_.print(',');
    output_.print(parameter_value);
  } else {
    output_.print(',');
  }
  output_.println();
}

void PrimitiveResultStream::value(const char* kind,
                                  const char* source,
                                  uint32_t time_us,
                                  double value,
                                  const char* parameter_key,
                                  const char* parameter_value,
                                  int digits) {
  prefix(kind, source, time_us);
  output_.print(value, digits);
  output_.print(',');
  parameters(parameter_key, parameter_value);
}

void PrimitiveResultStream::state(const char* kind,
                                  const char* source,
                                  uint32_t time_us,
                                  bool state,
                                  const char* parameter_key,
                                  const char* parameter_value) {
  prefix(kind, source, time_us);
  output_.print(',');
  output_.print(state ? 1 : 0);
  parameters(parameter_key, parameter_value);
}

}  // namespace experiments
}  // namespace betterboard
