#pragma once

#include <Arduino.h>

namespace betterboard {
namespace experiments {

// Lightweight serial framing for BetterBoard -> Engineering Lab acquisition.
// Metadata lines start with '#'; data rows are ordinary CSV.
class EngineeringLabStream {
 public:
  explicit EngineeringLabStream(Print& output);

  void begin(const char* experiment_id,
             const char* model_target,
             const char* columns,
             const char* units,
             uint32_t sample_interval_us,
             const char* configuration = nullptr);

  void rowBegin(uint32_t time_us);
  void field(long value);
  void field(unsigned long value);
  void field(int value);
  void field(float value, int digits = 6);
  void field(double value, int digits = 6);
  void field(const char* value);
  void rowEnd();

 private:
  void separator();

  Print& output_;
  bool row_open_;
};

}  // namespace experiments
}  // namespace betterboard
