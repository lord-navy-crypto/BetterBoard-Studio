#include "EngineeringLabStream.h"

namespace betterboard {
namespace experiments {

EngineeringLabStream::EngineeringLabStream(Print& output)
    : output_(output), row_open_(false) {}

void EngineeringLabStream::begin(const char* experiment_id,
                                 const char* model_target,
                                 const char* columns,
                                 const char* units,
                                 uint32_t sample_interval_us) {
  output_.println(F("#bb-engineering-lab-stream,1"));
  output_.print(F("#experiment_id,"));
  output_.println(experiment_id);
  output_.print(F("#model_target,"));
  output_.println(model_target);
  output_.print(F("#sample_interval_us,"));
  output_.println(sample_interval_us);
  output_.print(F("#columns,"));
  output_.println(columns);
  output_.print(F("#units,"));
  output_.println(units);
  output_.println(F("#data"));
}

void EngineeringLabStream::rowBegin(uint32_t time_us) {
  output_.print(time_us);
  row_open_ = true;
}

void EngineeringLabStream::separator() {
  if (row_open_) output_.print(',');
}

void EngineeringLabStream::field(long value) {
  separator();
  output_.print(value);
}

void EngineeringLabStream::field(unsigned long value) {
  separator();
  output_.print(value);
}

void EngineeringLabStream::field(int value) {
  separator();
  output_.print(value);
}

void EngineeringLabStream::field(float value, int digits) {
  separator();
  output_.print(value, digits);
}

void EngineeringLabStream::field(double value, int digits) {
  separator();
  output_.print(value, digits);
}

void EngineeringLabStream::field(const char* value) {
  separator();
  output_.print(value);
}

void EngineeringLabStream::rowEnd() {
  output_.println();
  row_open_ = false;
}

}  // namespace experiments
}  // namespace betterboard
