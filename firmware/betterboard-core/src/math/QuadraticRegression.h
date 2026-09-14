#pragma once

#include <math.h>
#include <stddef.h>

namespace betterboard { namespace math {

struct QuadraticFitResult {
    size_t count;
    double intercept;
    double linear;
    double quadratic;
    double rmse;
    double r_squared;
    double adjusted_r_squared;
    double aic;
    double aicc;
    double bic;
    double se_intercept;
    double se_linear;
    double se_quadratic;
    bool valid;
};

class QuadraticRegression {
public:
    QuadraticRegression() { reset(); }

    void reset() {
        n_ = 0;
        sx1_ = sx2_ = sx3_ = sx4_ = 0.0;
        sy_ = sy2_ = sxy_ = sx2y_ = 0.0;
    }

    void push(double x, double y) {
        if (!isfinite(x) || !isfinite(y)) return;
        const double x2 = x * x;
        ++n_;
        sx1_ += x;
        sx2_ += x2;
        sx3_ += x2 * x;
        sx4_ += x2 * x2;
        sy_ += y;
        sy2_ += y * y;
        sxy_ += x * y;
        sx2y_ += x2 * y;
    }

    size_t count() const { return n_; }

    QuadraticFitResult result() const {
        QuadraticFitResult out = {};
        out.count = n_;
        out.valid = false;
        if (n_ < 5) return out;

        double a[3][6] = {
            {static_cast<double>(n_), sx1_, sx2_, 1.0, 0.0, 0.0},
            {sx1_, sx2_, sx3_, 0.0, 1.0, 0.0},
            {sx2_, sx3_, sx4_, 0.0, 0.0, 1.0}
        };
        if (!invert3(a)) return out;
        const double inv[3][3] = {
            {a[0][3], a[0][4], a[0][5]},
            {a[1][3], a[1][4], a[1][5]},
            {a[2][3], a[2][4], a[2][5]}
        };
        const double xty[3] = {sy_, sxy_, sx2y_};
        double beta[3] = {0.0, 0.0, 0.0};
        for (size_t r = 0; r < 3; ++r)
            for (size_t c = 0; c < 3; ++c)
                beta[r] += inv[r][c] * xty[c];

        double beta_xty = 0.0;
        for (size_t i = 0; i < 3; ++i) beta_xty += beta[i] * xty[i];
        const double sse = fmax(0.0, sy2_ - beta_xty);
        const double mean_y = sy_ / static_cast<double>(n_);
        const double sst = fmax(0.0, sy2_ - static_cast<double>(n_) * mean_y * mean_y);
        const double r2 = sst > 0.0 ? 1.0 - sse / sst : (sse == 0.0 ? 1.0 : 0.0);
        const double residual_variance = sse / static_cast<double>(n_ - 3);
        const double variance_mle = fmax(sse / static_cast<double>(n_), 1e-30);
        const double aic = static_cast<double>(n_) * log(variance_mle) + 2.0 * 3.0;

        out.intercept = beta[0];
        out.linear = beta[1];
        out.quadratic = beta[2];
        out.rmse = sqrt(sse / static_cast<double>(n_));
        out.r_squared = r2;
        out.adjusted_r_squared = 1.0 - (1.0 - r2) * static_cast<double>(n_ - 1) / static_cast<double>(n_ - 3);
        out.aic = aic;
        out.aicc = n_ > 4 ? aic + 24.0 / static_cast<double>(n_ - 4) : INFINITY;
        out.bic = static_cast<double>(n_) * log(variance_mle) + 3.0 * log(static_cast<double>(n_));
        out.se_intercept = sqrt(fmax(0.0, residual_variance * inv[0][0]));
        out.se_linear = sqrt(fmax(0.0, residual_variance * inv[1][1]));
        out.se_quadratic = sqrt(fmax(0.0, residual_variance * inv[2][2]));
        out.valid = true;
        return out;
    }

private:
    static bool invert3(double a[3][6]) {
        for (size_t col = 0; col < 3; ++col) {
            size_t pivot = col;
            for (size_t row = col + 1; row < 3; ++row)
                if (fabs(a[row][col]) > fabs(a[pivot][col])) pivot = row;
            if (fabs(a[pivot][col]) < 1e-12) return false;
            if (pivot != col) {
                for (size_t j = 0; j < 6; ++j) {
                    const double t = a[col][j]; a[col][j] = a[pivot][j]; a[pivot][j] = t;
                }
            }
            const double scale = a[col][col];
            for (size_t j = 0; j < 6; ++j) a[col][j] /= scale;
            for (size_t row = 0; row < 3; ++row) {
                if (row == col) continue;
                const double factor = a[row][col];
                for (size_t j = 0; j < 6; ++j) a[row][j] -= factor * a[col][j];
            }
        }
        return true;
    }

    size_t n_;
    double sx1_, sx2_, sx3_, sx4_;
    double sy_, sy2_, sxy_, sx2y_;
};

inline double approximateCi95Low(double estimate, double standard_error) { return estimate - 1.96 * standard_error; }
inline double approximateCi95High(double estimate, double standard_error) { return estimate + 1.96 * standard_error; }

}} // namespace betterboard::math
