# BetterBoard C++ Math Runtime

## Purpose

BetterBoard now treats applied mathematics as a shared embedded/desktop capability rather than a desktop-only analysis surface. The C++ runtime carries fixed-memory, deterministic subsets that are useful close to acquisition; the desktop keeps larger-window inference, visualization, archival comparison, and analyses that are too expensive or too assumption-heavy for a microcontroller.

The rule is **same concepts, complementary execution**. A result computed on the MCU is a compact engineering summary or trigger, not a replacement for preserved raw evidence and downstream validation.

## Embedded C++ capabilities

Available through `#include <BetterBoard.h>`:

- robust summary: mean, sample standard deviation, standard error, median, MAD, robust sigma, trimmed mean
- MAD-based outlier flagging
- Type-A + sensor + scale root-sum-square uncertainty budget and approximate expanded 95% uncertainty
- autocorrelation and effective sample-size approximation
- fixed-memory radix-2 `SmallFFT<N>` with dominant-bin and bin-frequency helpers
- streaming quadratic regression with parameter standard errors, RMSE, R², adjusted R², AIC, AICc and BIC
- generic residual/model diagnostics: bias, MAE, RMSE, residual spread, R², adjusted R², AIC/AICc/BIC
- EWMA monitoring
- CUSUM change detection
- fixed-window mean-shift detection
- fixed-memory sequential experiment planning for linear or quadratic design matrices
- candidate leverage `hᵀ(XᵀX)⁻¹h`, `log(1 + leverage)` information proxy, coverage distance, replication count and extrapolation flag

All new runtime components avoid heap allocation. Window sizes and planning capacities are compile-time template parameters so sketches pay memory cost only for the capabilities they instantiate.

## UNO versus ESP32

The API is shared but the recommended capacities differ.

### UNO-safe use

Prefer small instances and streaming summaries:

```cpp
betterboard::math::SmallFFT<8> fft;
betterboard::signal::WindowMeanShift<8> shift;
betterboard::math::SequentialPlanner<16> planner;
```

UNO should prioritize acquisition timing and evidence integrity. Large windows, repeated FFTs, or broad candidate scans should normally remain desktop work.

### ESP32 extended use

ESP32-class targets can use larger fixed windows when the experiment budget allows, for example `SmallFFT<64>` or larger planning histories. This still does not justify hiding raw samples or moving all scientific interpretation onto the MCU.

## Data flow

```text
sensor / driver
  -> AcquisitionResult<T>
  -> EvidenceRecord
  -> optional embedded math runtime
       robust summary / FFT / detector / fit / DOE score
  -> EngineeringLabStream / raw telemetry
  -> BetterBoard desktop
       larger-window statistics / plots / cross-run comparison / model selection / DOE
```

The recommended telemetry pattern is to preserve raw or canonical evidence rows and emit MCU summaries as explicitly derived fields or tagged summary rows. Desktop software should be able to recompute or challenge an MCU-side conclusion from the archived evidence when enough raw data is available.

## Statistical boundaries

- MAD outlier detection flags observations; it does not delete them.
- Effective sample size is an approximation based on positive autocorrelation sequence, not an exact count of independent physical observations.
- FFT output describes the sampled sequence. It cannot prove that no pre-sampling aliasing occurred.
- Approximate 95% intervals use normal-style multipliers in the compact embedded layer; desktop inference may use more appropriate finite-sample or resampling methods.
- AIC/AICc/BIC compare candidate models under their assumptions; the smallest value is not proof of physical truth.
- Fisher/leverage DOE scoring is conditional on the selected linear-in-parameters design model and comparable independent noise. Hardware limits, hysteresis, drift, cost, and safety remain experiment constraints.
- Root-sum-square uncertainty assumes the entered components can be combined as independent standard uncertainties. Correlated uncertainty remains a desktop/covariance-aware task unless explicitly modeled.

## Verification

`BetterBoard C++ Core` CI now performs:

1. existing native core tests;
2. dedicated native embedded-math runtime tests;
3. UNO compile of the existing core example;
4. ESP32-S3 compile of the existing core example;
5. UNO compile of `MathRuntimeFusion`;
6. ESP32-S3 compile of `MathRuntimeFusion`;
7. migrated Sensor Suite UNO/ESP32-S3 compiles.

`MathRuntimeFusion` demonstrates direct Arduino/ESP32 use of online statistics, EWMA, CUSUM, small FFT, quadratic regression and sequential-planning scores.

## What remains primarily desktop-side

The embedded runtime intentionally does not absorb large bootstrap/Monte-Carlo campaigns, publication-scale FFT/PSD processing, arbitrary-size matrix algebra, full covariance-aware uncertainty propagation, broad Bayesian posterior sampling, or large adaptive-design searches. Those are better performed after evidence reaches BetterBoard, where compute and memory do not compete with acquisition deadlines.

This split is a resource boundary, not a conceptual boundary: embedded and desktop layers should use compatible definitions and exchange enough provenance for results to be compared.
