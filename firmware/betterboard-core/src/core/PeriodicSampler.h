#pragma once

#include <stdint.h>

namespace betterboard {
namespace core {

class PeriodicSampler {
public:
    explicit PeriodicSampler(uint32_t period_us = 10000U);

    void setPeriodMicros(uint32_t period_us);
    uint32_t periodMicros() const;
    void reset(uint32_t now_us = 0U);
    void arm(uint32_t now_us);
    bool ready(uint32_t now_us);

private:
    uint32_t period_us_;
    uint32_t next_due_us_;
    bool armed_;
};

}  // namespace core
}  // namespace betterboard
