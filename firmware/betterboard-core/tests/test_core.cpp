#include <assert.h>
#include <math.h>

#include "../src/core/PeriodicSampler.h"
#include "../src/math/FiniteDifference.h"
#include "../src/math/OnlineStatistics.h"
#include "../src/math/TrapezoidIntegrator.h"
#include "../src/signal/ExponentialMovingAverage.h"
#include "../src/signal/PeakHold.h"

static bool near(double a, double b, double eps = 1e-9) {
    return fabs(a - b) <= eps;
}

int main() {
    using betterboard::core::PeriodicSampler;
    using betterboard::math::FiniteDifference;
    using betterboard::math::OnlineStatistics;
    using betterboard::math::TrapezoidIntegrator;
    using betterboard::signal::ExponentialMovingAverage;
    using betterboard::signal::PeakHold;

    OnlineStatistics stats;
    stats.push(1.0);
    stats.push(2.0);
    stats.push(3.0);
    assert(stats.count() == 3U);
    assert(near(stats.mean(), 2.0));
    assert(near(stats.variancePopulation(), 2.0 / 3.0));
    assert(near(stats.peakToPeak(), 2.0));

    TrapezoidIntegrator integrator;
    assert(!integrator.push(0.0, 2.0));
    assert(integrator.push(1.0, 2.0));
    assert(integrator.push(2.0, 2.0));
    assert(near(integrator.value(), 4.0));
    assert(!integrator.push(2.0, 99.0));

    FiniteDifference derivative;
    assert(!derivative.push(0.0, 0.0));
    assert(derivative.push(0.5, 1.0));
    assert(near(derivative.derivative(), 2.0));

    ExponentialMovingAverage ema(0.5);
    assert(near(ema.push(2.0), 2.0));
    assert(near(ema.push(4.0), 3.0));

    PeakHold peak;
    assert(near(peak.push(-2.0), -2.0));
    assert(near(peak.push(-3.0), -2.0));
    assert(near(peak.push(5.0), 5.0));

    PeriodicSampler sampler(100U);
    assert(sampler.ready(1000U));
    assert(!sampler.ready(1050U));
    assert(sampler.ready(1100U));
    assert(sampler.ready(1400U));
    assert(!sampler.ready(1401U));

    return 0;
}
