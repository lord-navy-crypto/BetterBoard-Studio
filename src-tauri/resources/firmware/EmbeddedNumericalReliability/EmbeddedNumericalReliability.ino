#include <Arduino.h>
#include <float.h>
#include <math.h>
#include <stdint.h>

// BetterBoard Bench 03 — Embedded Numerical Reliability
//
// This firmware intentionally performs the same educational Taylor-recurrence
// experiment as the Numerical Error Analysis Studio, but on the actual MCU.
// It emits numeric-only rows so BetterBoard's canonical measurement pipeline
// can preserve the complete campaign without a special serial parser.
//
// Schema:
// study_code,method_code,x_bits,x,term_limit,reduced_x,approximation,
// terms_used,last_term,cancellation_ratio,stop_rule,finite,elapsed_us,
// float_bytes,double_bytes,float_epsilon
//
// study_code: 1 = parameter scan, 2 = fixed-term convergence
// method_code: 0 = raw Taylor, 1 = range-reduced Taylor

namespace {
constexpr uint32_t BAUD = 115200;
constexpr float TOLERANCE_MULTIPLIER = 8.0f;
constexpr uint16_t PARAMETER_MAX_TERMS = 120;
constexpr uint16_t CONVERGENCE_MAX_TERMS = 25;
constexpr uint8_t PARAMETER_POINTS = 33;
constexpr float X_MIN = -80.0f;
constexpr float X_MAX = 80.0f;
constexpr float CONVERGENCE_X = 80.0f;
constexpr float PI_F = 3.14159265358979323846f;
constexpr float TWO_PI_F = 2.0f * PI_F;
constexpr float HALF_PI_F = 0.5f * PI_F;

struct NumericalResult {
  float original_x;
  float reduced_x;
  float value;
  float last_term;
  float cancellation_ratio;
  uint16_t terms_used;
  bool stopping_criterion_met;
  bool arithmetic_finite;
  uint32_t elapsed_us;
};

uint32_t floatBits(float value) {
  union {
    float f;
    uint32_t u;
  } bits;
  bits.f = value;
  return bits.u;
}

float reduceSineArgument(float x) {
  float y = fmodf(x + PI_F, TWO_PI_F);
  if (y < 0.0f) y += TWO_PI_F;
  y -= PI_F;
  if (y > HALF_PI_F) {
    y = PI_F - y;
  } else if (y < -HALF_PI_F) {
    y = -PI_F - y;
  }
  return y;
}

NumericalResult evaluateTaylor(float x, bool range_reduced, uint16_t max_terms, uint16_t fixed_terms) {
  const uint32_t started = micros();
  const float reduced = range_reduced ? reduceSineArgument(x) : x;
  float term = reduced;
  float total = reduced;
  float sum_abs_terms = fabsf(term);
  uint16_t terms_used = 1;
  bool finite = isfinite(term) && isfinite(total) && isfinite(sum_abs_terms);
  bool stopped = (reduced == 0.0f && fixed_terms == 0);

  const float eps = FLT_EPSILON;
  const float atol = TOLERANCE_MULTIPLIER * eps;
  const uint16_t target_terms = fixed_terms > 0 ? fixed_terms : max_terms;

  if ((!stopped || fixed_terms > 0) && target_terms > 1) {
    for (uint16_t term_index = 1; term_index < target_terms; ++term_index) {
      const float a = static_cast<float>(2UL * term_index);
      const float denominator = a * (a + 1.0f);
      term = term * (-reduced * reduced) / denominator;
      total += term;
      sum_abs_terms += fabsf(term);
      terms_used = term_index + 1;

      if (!isfinite(term) || !isfinite(total) || !isfinite(sum_abs_terms)) {
        finite = false;
        break;
      }

      const float threshold = atol + TOLERANCE_MULTIPLIER * eps * fabsf(total);
      if (fixed_terms == 0 && fabsf(term) <= threshold) {
        stopped = true;
        break;
      }
    }
  }

  if (fixed_terms > 0 && finite) {
    const float threshold = atol + TOLERANCE_MULTIPLIER * eps * fabsf(total);
    stopped = fabsf(term) <= threshold;
  }

  float cancellation = INFINITY;
  if (finite) {
    const float denominator = fmaxf(fabsf(total), FLT_MIN);
    cancellation = sum_abs_terms / denominator;
  }

  NumericalResult result;
  result.original_x = x;
  result.reduced_x = reduced;
  result.value = finite ? total : NAN;
  result.last_term = term;
  result.cancellation_ratio = cancellation;
  result.terms_used = terms_used;
  result.stopping_criterion_met = stopped;
  result.arithmetic_finite = finite;
  result.elapsed_us = micros() - started;
  return result;
}

void printFloat(float value) {
  if (isnan(value)) {
    Serial.print("nan");
  } else if (isinf(value)) {
    Serial.print(value > 0 ? "inf" : "-inf");
  } else {
    Serial.print(value, 9);
  }
}

void emitResult(uint8_t study_code, uint8_t method_code, uint16_t term_limit,
                const NumericalResult& result) {
  Serial.print(study_code);
  Serial.print(',');
  Serial.print(method_code);
  Serial.print(',');
  Serial.print(floatBits(result.original_x));
  Serial.print(',');
  printFloat(result.original_x);
  Serial.print(',');
  Serial.print(term_limit);
  Serial.print(',');
  printFloat(result.reduced_x);
  Serial.print(',');
  printFloat(result.value);
  Serial.print(',');
  Serial.print(result.terms_used);
  Serial.print(',');
  printFloat(result.last_term);
  Serial.print(',');
  printFloat(result.cancellation_ratio);
  Serial.print(',');
  Serial.print(result.stopping_criterion_met ? 1 : 0);
  Serial.print(',');
  Serial.print(result.arithmetic_finite ? 1 : 0);
  Serial.print(',');
  Serial.print(result.elapsed_us);
  Serial.print(',');
  Serial.print(sizeof(float));
  Serial.print(',');
  Serial.print(sizeof(double));
  Serial.print(',');
  Serial.println(FLT_EPSILON, 12);
}

void runParameterScan() {
  for (uint8_t point = 0; point < PARAMETER_POINTS; ++point) {
    const float fraction = PARAMETER_POINTS == 1
        ? 0.0f
        : static_cast<float>(point) / static_cast<float>(PARAMETER_POINTS - 1);
    const float x = X_MIN + fraction * (X_MAX - X_MIN);

    const NumericalResult raw = evaluateTaylor(x, false, PARAMETER_MAX_TERMS, 0);
    emitResult(1, 0, PARAMETER_MAX_TERMS, raw);

    const NumericalResult reduced = evaluateTaylor(x, true, PARAMETER_MAX_TERMS, 0);
    emitResult(1, 1, PARAMETER_MAX_TERMS, reduced);
  }
}

void runConvergenceStudy() {
  for (uint16_t terms = 1; terms <= CONVERGENCE_MAX_TERMS; ++terms) {
    const NumericalResult raw = evaluateTaylor(CONVERGENCE_X, false, PARAMETER_MAX_TERMS, terms);
    emitResult(2, 0, terms, raw);

    const NumericalResult reduced = evaluateTaylor(CONVERGENCE_X, true, PARAMETER_MAX_TERMS, terms);
    emitResult(2, 1, terms, reduced);
  }
}

void runCampaign() {
  runParameterScan();
  runConvergenceStudy();
}
}  // namespace

void setup() {
  Serial.begin(BAUD);
  // BetterBoard opens the serial device after upload/capture and many AVR
  // USB-serial boards reset on open. Delay long enough for the host reader to
  // become ready before the deterministic campaign starts.
  delay(2200);
  runCampaign();
}

void loop() {
  // One serial-open/reset produces one deterministic campaign. This avoids
  // silently mixing repeated campaigns in a single Measurement package.
  delay(1000);
}
