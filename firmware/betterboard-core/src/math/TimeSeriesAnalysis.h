#pragma once

#include <math.h>
#include <stddef.h>

namespace betterboard { namespace math {

inline double autocorrelation(const double* values, size_t n, size_t lag) {
    if (!values || n < 2 || lag >= n) return NAN;
    double mean = 0.0;
    for (size_t i = 0; i < n; ++i) mean += values[i];
    mean /= static_cast<double>(n);
    double denom = 0.0;
    for (size_t i = 0; i < n; ++i) {
        const double d = values[i] - mean;
        denom += d * d;
    }
    if (!(denom > 0.0)) return 0.0;
    double numer = 0.0;
    for (size_t i = lag; i < n; ++i) numer += (values[i] - mean) * (values[i - lag] - mean);
    return numer / denom;
}

// Initial-positive-sequence approximation. Negative/non-finite rho terminates the sum.
inline double effectiveSampleSize(const double* values, size_t n, size_t max_lag = 32) {
    if (!values || n < 2) return static_cast<double>(n);
    if (max_lag >= n) max_lag = n - 1;
    double correlation_sum = 0.0;
    for (size_t lag = 1; lag <= max_lag; ++lag) {
        const double rho = autocorrelation(values, n, lag);
        if (!isfinite(rho) || rho <= 0.0) break;
        correlation_sum += rho;
    }
    const double neff = static_cast<double>(n) / (1.0 + 2.0 * correlation_sum);
    return fmax(1.0, fmin(static_cast<double>(n), neff));
}

template <size_t N>
class SmallFFT {
public:
    static_assert(N >= 2 && (N & (N - 1)) == 0, "SmallFFT size must be a power of two");

    SmallFFT() { reset(); }

    void reset() {
        count_ = 0;
        for (size_t i = 0; i < N; ++i) { real_[i] = 0.0f; imag_[i] = 0.0f; }
    }

    bool push(float value) {
        if (count_ >= N) return false;
        real_[count_++] = value;
        return true;
    }

    bool ready() const { return count_ == N; }
    size_t size() const { return N; }

    bool transform() {
        if (!ready()) return false;
        size_t j = 0;
        for (size_t i = 1; i < N; ++i) {
            size_t bit = N >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                const float tr = real_[i]; real_[i] = real_[j]; real_[j] = tr;
                const float ti = imag_[i]; imag_[i] = imag_[j]; imag_[j] = ti;
            }
        }
        const float pi = 3.14159265358979323846f;
        for (size_t len = 2; len <= N; len <<= 1) {
            const float angle = -2.0f * pi / static_cast<float>(len);
            const float wlen_r = cosf(angle);
            const float wlen_i = sinf(angle);
            for (size_t i = 0; i < N; i += len) {
                float wr = 1.0f, wi = 0.0f;
                for (size_t k = 0; k < len / 2; ++k) {
                    const size_t even = i + k;
                    const size_t odd = even + len / 2;
                    const float vr = real_[odd] * wr - imag_[odd] * wi;
                    const float vi = real_[odd] * wi + imag_[odd] * wr;
                    const float ur = real_[even], ui = imag_[even];
                    real_[even] = ur + vr; imag_[even] = ui + vi;
                    real_[odd] = ur - vr; imag_[odd] = ui - vi;
                    const float next_wr = wr * wlen_r - wi * wlen_i;
                    wi = wr * wlen_i + wi * wlen_r;
                    wr = next_wr;
                }
            }
        }
        return true;
    }

    float magnitude(size_t bin) const {
        if (bin >= N) return NAN;
        return sqrtf(real_[bin] * real_[bin] + imag_[bin] * imag_[bin]);
    }

    size_t dominantBin(bool ignore_dc = true) const {
        const size_t begin = ignore_dc ? 1U : 0U;
        const size_t end = N / 2U;
        size_t best = begin;
        float best_mag = -1.0f;
        for (size_t i = begin; i <= end; ++i) {
            const float mag = magnitude(i);
            if (mag > best_mag) { best_mag = mag; best = i; }
        }
        return best;
    }

    float binFrequency(size_t bin, float sample_rate_hz) const {
        return sample_rate_hz * static_cast<float>(bin) / static_cast<float>(N);
    }

private:
    float real_[N];
    float imag_[N];
    size_t count_;
};

}} // namespace betterboard::math
