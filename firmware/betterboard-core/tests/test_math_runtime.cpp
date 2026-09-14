#include <assert.h>
#include <math.h>

#include "../src/BetterBoard.h"

static bool near(double a, double b, double eps = 1e-6) {
    return fabs(a - b) <= eps;
}

int main() {
    using namespace betterboard;

    // Robust statistics and uncertainty budget.
    const double robust_values[] = {1.0, 2.0, 2.0, 3.0, 100.0};
    double scratch[5];
    math::RobustSummary summary{};
    assert(math::robustSummary(robust_values, 5, scratch, summary));
    assert(near(summary.median, 2.0));
    assert(near(summary.mad, 1.0));
    assert(summary.robust_sigma > 1.48 && summary.robust_sigma < 1.49);
    assert(math::isMadOutlier(100.0, summary.median, summary.mad));
    assert(near(math::combinedStandardUncertainty(3.0, 4.0, 0.0), 5.0));
    assert(near(math::expandedUncertainty95(5.0), 9.8));

    // Correlated samples must have lower effective sample size than raw count.
    const double correlated[] = {0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0};
    const double rho1 = math::autocorrelation(correlated, 8, 1);
    assert(rho1 > 0.5);
    const double neff = math::effectiveSampleSize(correlated, 8, 4);
    assert(neff >= 1.0 && neff < 8.0);

    // Small fixed-memory FFT: one cycle in 8 samples should peak at bin 1.
    math::SmallFFT<8> fft;
    const float sine8[] = {0.0f, 0.70710678f, 1.0f, 0.70710678f, 0.0f, -0.70710678f, -1.0f, -0.70710678f};
    for (float value : sine8) assert(fft.push(value));
    assert(fft.ready());
    assert(fft.transform());
    assert(fft.dominantBin() == 1U);
    assert(near(fft.binFrequency(1U, 80.0f), 10.0));

    // Quadratic parameter recovery and model-selection diagnostics.
    math::QuadraticRegression quadratic;
    for (int x = -3; x <= 3; ++x) quadratic.push(static_cast<double>(x), 1.0 + 2.0 * x + 0.5 * x * x);
    const math::QuadraticFitResult qfit = quadratic.result();
    assert(qfit.valid);
    assert(near(qfit.intercept, 1.0));
    assert(near(qfit.linear, 2.0));
    assert(near(qfit.quadratic, 0.5));
    assert(qfit.rmse < 1e-6);
    assert(qfit.r_squared > 0.999999);

    const double observed[] = {1.0, 3.0, 5.0, 7.0, 9.0};
    const double predicted[] = {1.1, 2.9, 5.0, 7.1, 8.9};
    const math::ModelDiagnostics diag = math::modelDiagnostics(observed, predicted, 5, 2);
    assert(diag.valid);
    assert(fabs(diag.bias) < 1e-12);
    assert(diag.rmse > 0.0);
    assert(isfinite(diag.aicc));
    assert(isfinite(diag.bic));

    // Streaming change detection.
    signal::EwmaMonitor ewma(0.5);
    assert(near(ewma.push(2.0), 2.0));
    assert(near(ewma.push(4.0), 3.0));

    signal::CusumDetector cusum(0.0, 0.1, 1.0);
    assert(!cusum.update(0.05));
    bool alarm = false;
    for (int i = 0; i < 5; ++i) alarm = alarm || cusum.update(0.6);
    assert(alarm);

    signal::WindowMeanShift<8> shift;
    for (int i = 0; i < 4; ++i) shift.push(0.0);
    for (int i = 0; i < 4; ++i) shift.push(2.0);
    assert(shift.ready());
    assert(near(shift.meanShift(), 2.0));
    assert(shift.exceeds(1.0));

    // Lightweight DOE scoring: endpoints provide higher parameter leverage than the center for a linear design.
    math::SequentialPlanner<16> planner(math::PlanningModel::Linear);
    assert(planner.push(-1.0));
    assert(planner.push(0.0));
    assert(planner.push(1.0));
    math::CandidateScore center{}, edge{};
    assert(planner.score(0.0, center));
    assert(planner.score(1.0, edge));
    assert(edge.information_leverage > center.information_leverage);
    assert(center.replication_count == 1U);
    assert(!center.extrapolation);
    assert(math::SequentialPlanner<16>::uncertaintyReductionProxy(edge) > 0.0);

    return 0;
}
