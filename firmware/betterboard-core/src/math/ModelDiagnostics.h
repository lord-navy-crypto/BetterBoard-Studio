#pragma once

#include <math.h>
#include <stddef.h>

namespace betterboard { namespace math {

struct ModelDiagnostics {
    size_t count;
    size_t parameter_count;
    double bias;
    double mae;
    double rmse;
    double residual_stddev;
    double r_squared;
    double adjusted_r_squared;
    double aic;
    double aicc;
    double bic;
    bool valid;
};

inline ModelDiagnostics modelDiagnostics(const double* observed, const double* predicted,
                                         size_t n, size_t parameter_count) {
    ModelDiagnostics out = {};
    out.count = n;
    out.parameter_count = parameter_count;
    out.valid = false;
    if (!observed || !predicted || n == 0 || parameter_count == 0 || n <= parameter_count) return out;

    double mean_y = 0.0;
    for (size_t i = 0; i < n; ++i) {
        if (!isfinite(observed[i]) || !isfinite(predicted[i])) return out;
        mean_y += observed[i];
    }
    mean_y /= static_cast<double>(n);

    double sum_r = 0.0, sum_abs = 0.0, sse = 0.0, sst = 0.0;
    for (size_t i = 0; i < n; ++i) {
        const double r = observed[i] - predicted[i];
        sum_r += r;
        sum_abs += fabs(r);
        sse += r * r;
        const double centered = observed[i] - mean_y;
        sst += centered * centered;
    }
    const double bias = sum_r / static_cast<double>(n);
    double centered_residual_ss = 0.0;
    for (size_t i = 0; i < n; ++i) {
        const double r = (observed[i] - predicted[i]) - bias;
        centered_residual_ss += r * r;
    }
    const double r2 = sst > 0.0 ? 1.0 - sse / sst : (sse == 0.0 ? 1.0 : 0.0);
    const double variance_mle = fmax(sse / static_cast<double>(n), 1e-30);
    const double k = static_cast<double>(parameter_count);
    const double dn = static_cast<double>(n);
    const double aic = dn * log(variance_mle) + 2.0 * k;

    out.bias = bias;
    out.mae = sum_abs / dn;
    out.rmse = sqrt(sse / dn);
    out.residual_stddev = n > 1 ? sqrt(centered_residual_ss / static_cast<double>(n - 1)) : 0.0;
    out.r_squared = r2;
    out.adjusted_r_squared = n > parameter_count + 1
        ? 1.0 - (1.0 - r2) * static_cast<double>(n - 1) / static_cast<double>(n - parameter_count)
        : NAN;
    out.aic = aic;
    out.aicc = n > parameter_count + 1
        ? aic + (2.0 * k * (k + 1.0)) / static_cast<double>(n - parameter_count - 1)
        : INFINITY;
    out.bic = dn * log(variance_mle) + k * log(dn);
    out.valid = true;
    return out;
}

}} // namespace betterboard::math
