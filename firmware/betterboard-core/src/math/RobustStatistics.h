#pragma once

#include <math.h>
#include <stddef.h>

namespace betterboard { namespace math {

struct RobustSummary {
    size_t count;
    double mean;
    double sample_stddev;
    double standard_error;
    double median;
    double mad;
    double robust_sigma;
    double trimmed_mean;
};

inline void insertionSort(double* values, size_t n) {
    for (size_t i = 1; i < n; ++i) {
        const double key = values[i];
        size_t j = i;
        while (j > 0 && values[j - 1] > key) {
            values[j] = values[j - 1];
            --j;
        }
        values[j] = key;
    }
}

inline double sortedMedian(const double* sorted, size_t n) {
    if (n == 0) return NAN;
    const size_t mid = n / 2;
    return (n & 1U) ? sorted[mid] : 0.5 * (sorted[mid - 1] + sorted[mid]);
}

// Caller supplies scratch space of at least n doubles. No heap allocation is used.
inline bool robustSummary(const double* values, size_t n, double* scratch, RobustSummary& out,
                          double trim_fraction = 0.10) {
    if (!values || !scratch || n == 0) return false;
    double sum = 0.0;
    double sum_sq = 0.0;
    for (size_t i = 0; i < n; ++i) {
        if (!isfinite(values[i])) return false;
        scratch[i] = values[i];
        sum += values[i];
        sum_sq += values[i] * values[i];
    }
    insertionSort(scratch, n);
    const double mean = sum / static_cast<double>(n);
    const double variance = n > 1
        ? fmax(0.0, (sum_sq - static_cast<double>(n) * mean * mean) / static_cast<double>(n - 1))
        : 0.0;
    const double median = sortedMedian(scratch, n);
    for (size_t i = 0; i < n; ++i) scratch[i] = fabs(values[i] - median);
    insertionSort(scratch, n);
    const double mad = sortedMedian(scratch, n);

    size_t trim = static_cast<size_t>(floor(trim_fraction * static_cast<double>(n)));
    if (2 * trim >= n) trim = 0;
    for (size_t i = 0; i < n; ++i) scratch[i] = values[i];
    insertionSort(scratch, n);
    double trimmed_sum = 0.0;
    for (size_t i = trim; i < n - trim; ++i) trimmed_sum += scratch[i];
    const size_t trimmed_n = n - 2 * trim;

    out.count = n;
    out.mean = mean;
    out.sample_stddev = sqrt(variance);
    out.standard_error = n > 0 ? out.sample_stddev / sqrt(static_cast<double>(n)) : NAN;
    out.median = median;
    out.mad = mad;
    out.robust_sigma = 1.4826 * mad;
    out.trimmed_mean = trimmed_sum / static_cast<double>(trimmed_n);
    return true;
}

inline double combinedStandardUncertainty(double type_a, double sensor, double scale) {
    return sqrt(type_a * type_a + sensor * sensor + scale * scale);
}

inline double expandedUncertainty95(double combined_standard_uncertainty) {
    return 1.96 * combined_standard_uncertainty;
}

inline bool isMadOutlier(double value, double median, double mad, double threshold = 3.5) {
    if (!(mad > 0.0) || !isfinite(value)) return false;
    const double robust_z = 0.6744897501960817 * (value - median) / mad;
    return fabs(robust_z) > threshold;
}

}} // namespace betterboard::math
