#pragma once

#include <math.h>
#include <stddef.h>

namespace betterboard { namespace math {

enum class PlanningModel { Linear, Quadratic };

struct CandidateScore {
    double x;
    double information_leverage;
    double information_gain;
    double coverage_distance;
    size_t replication_count;
    bool extrapolation;
};

template <size_t MaxObservations>
class SequentialPlanner {
public:
    explicit SequentialPlanner(PlanningModel model = PlanningModel::Linear)
        : model_(model), count_(0) {}

    void reset() { count_ = 0; }
    bool push(double x) {
        if (!isfinite(x) || count_ >= MaxObservations) return false;
        x_[count_++] = x;
        return true;
    }
    size_t count() const { return count_; }

    bool score(double candidate, CandidateScore& out) const {
        const size_t p = model_ == PlanningModel::Quadratic ? 3U : 2U;
        if (count_ < p || !isfinite(candidate)) return false;
        double xtx[3][3] = {{0.0}};
        for (size_t i = 0; i < count_; ++i) {
            double h[3]; designVector(x_[i], h);
            for (size_t r = 0; r < p; ++r)
                for (size_t c = 0; c < p; ++c)
                    xtx[r][c] += h[r] * h[c];
        }
        double inv[3][3] = {{0.0}};
        if (!invert(xtx, p, inv)) return false;
        double h[3]; designVector(candidate, h);
        double leverage = 0.0;
        for (size_t r = 0; r < p; ++r)
            for (size_t c = 0; c < p; ++c)
                leverage += h[r] * inv[r][c] * h[c];

        double min_x = x_[0], max_x = x_[0], nearest = fabs(candidate - x_[0]);
        size_t replication = 0;
        const double tol = rangeTolerance();
        for (size_t i = 0; i < count_; ++i) {
            min_x = fmin(min_x, x_[i]); max_x = fmax(max_x, x_[i]);
            nearest = fmin(nearest, fabs(candidate - x_[i]));
            if (fabs(candidate - x_[i]) <= tol) ++replication;
        }
        out.x = candidate;
        out.information_leverage = fmax(0.0, leverage);
        out.information_gain = log1p(out.information_leverage);
        out.coverage_distance = nearest;
        out.replication_count = replication;
        out.extrapolation = candidate < min_x || candidate > max_x;
        return true;
    }

    static double uncertaintyReductionProxy(const CandidateScore& score) {
        return 1.0 - 1.0 / (1.0 + score.information_leverage);
    }

private:
    void designVector(double x, double out[3]) const {
        out[0] = 1.0; out[1] = x; out[2] = x * x;
    }

    double rangeTolerance() const {
        if (count_ < 2) return 1e-9;
        double min_x = x_[0], max_x = x_[0];
        for (size_t i = 1; i < count_; ++i) { min_x = fmin(min_x, x_[i]); max_x = fmax(max_x, x_[i]); }
        return fmax(1e-9, (max_x - min_x) * 1e-6);
    }

    static bool invert(const double source[3][3], size_t n, double out[3][3]) {
        double a[3][6] = {{0.0}};
        for (size_t r = 0; r < n; ++r) {
            for (size_t c = 0; c < n; ++c) a[r][c] = source[r][c];
            a[r][n + r] = 1.0;
        }
        for (size_t col = 0; col < n; ++col) {
            size_t pivot = col;
            for (size_t r = col + 1; r < n; ++r)
                if (fabs(a[r][col]) > fabs(a[pivot][col])) pivot = r;
            if (fabs(a[pivot][col]) < 1e-12) return false;
            if (pivot != col) for (size_t j = 0; j < 2 * n; ++j) { const double t = a[col][j]; a[col][j] = a[pivot][j]; a[pivot][j] = t; }
            const double scale = a[col][col];
            for (size_t j = 0; j < 2 * n; ++j) a[col][j] /= scale;
            for (size_t r = 0; r < n; ++r) {
                if (r == col) continue;
                const double factor = a[r][col];
                for (size_t j = 0; j < 2 * n; ++j) a[r][j] -= factor * a[col][j];
            }
        }
        for (size_t r = 0; r < n; ++r) for (size_t c = 0; c < n; ++c) out[r][c] = a[r][n + c];
        return true;
    }

    PlanningModel model_;
    double x_[MaxObservations];
    size_t count_;
};

}} // namespace betterboard::math
