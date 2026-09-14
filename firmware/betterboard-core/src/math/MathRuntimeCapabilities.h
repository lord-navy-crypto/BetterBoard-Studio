#pragma once

#include <stddef.h>
#include <stdint.h>

namespace betterboard { namespace math {

struct MathRuntimeCapabilities {
    uint8_t protocol_version;
    const char* profile;
    bool robust_statistics;
    bool uncertainty_budget;
    bool autocorrelation;
    bool small_fft;
    bool quadratic_regression;
    bool model_diagnostics;
    bool change_detection;
    bool sequential_planning;
    size_t recommended_fft_points;
    size_t recommended_window_points;
    size_t recommended_planner_observations;
};

inline MathRuntimeCapabilities currentMathRuntimeCapabilities() {
#if defined(ARDUINO_ARCH_AVR)
    return {1U, "avr-lite", true, true, true, true, true, true, true, true, 8U, 16U, 16U};
#elif defined(ARDUINO_ARCH_ESP32) || defined(ESP32)
    return {1U, "esp32-extended", true, true, true, true, true, true, true, true, 64U, 128U, 128U};
#else
    return {1U, "portable-cpp", true, true, true, true, true, true, true, true, 32U, 64U, 64U};
#endif
}

}}  // namespace betterboard::math
