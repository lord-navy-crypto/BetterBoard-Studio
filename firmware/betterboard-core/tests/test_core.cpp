#include <assert.h>
#include <math.h>

#include "../src/core/Clock.h"
#include "../src/core/PeriodicSampler.h"
#include "../src/core/RingBuffer.h"
#include "../src/core/SampleClock.h"
#include "../src/experiments/EngineeringLabEvidence.h"
#include "../src/experiments/EvidenceRecord.h"
#include "../src/hal/FakeSensor.h"
#include "../src/math/FiniteDifference.h"
#include "../src/math/LinearRegression.h"
#include "../src/math/OnlineStatistics.h"
#include "../src/math/RmsAccumulator.h"
#include "../src/math/TrapezoidIntegrator.h"
#include "../src/measurement/AcquisitionResult.h"
#include "../src/measurement/Sample.h"
#include "../src/signal/ExponentialMovingAverage.h"
#include "../src/signal/HysteresisLatch.h"
#include "../src/signal/PeakHold.h"
#include "../src/signal/ThresholdTrigger.h"

static bool near(double a, double b, double eps = 1e-9) {
    return fabs(a - b) <= eps;
}

int main() {
    using betterboard::core::ManualClock;
    using betterboard::core::PeriodicSampler;
    using betterboard::core::RingBuffer;
    using betterboard::core::SampleClock;
    using betterboard::experiments::EvidenceRecord;
    using betterboard::experiments::makeEvidenceRecord;
    using betterboard::hal::FakeSensor;
    using betterboard::math::FiniteDifference;
    using betterboard::math::LinearRegression;
    using betterboard::math::OnlineStatistics;
    using betterboard::math::RmsAccumulator;
    using betterboard::math::TrapezoidIntegrator;
    using betterboard::measurement::AcquisitionResult;
    using betterboard::measurement::AcquisitionStatus;
    using betterboard::measurement::Sample;
    using betterboard::signal::ExponentialMovingAverage;
    using betterboard::signal::HysteresisLatch;
    using betterboard::signal::PeakHold;
    using betterboard::signal::ThresholdTrigger;

    OnlineStatistics stats;
    stats.push(1.0); stats.push(2.0); stats.push(3.0);
    assert(stats.count() == 3U);
    assert(near(stats.mean(), 2.0));
    assert(near(stats.variancePopulation(), 2.0 / 3.0));
    assert(near(stats.peakToPeak(), 2.0));

    RmsAccumulator rms;
    rms.push(3.0); rms.push(4.0);
    assert(rms.count() == 2U);
    assert(near(rms.rms(), sqrt(12.5)));

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

    LinearRegression regression;
    regression.push(0.0, 1.0);
    regression.push(1.0, 3.0);
    regression.push(2.0, 5.0);
    assert(regression.valid());
    assert(near(regression.slope(), 2.0));
    assert(near(regression.intercept(), 1.0));
    assert(near(regression.rSquared(), 1.0));

    ExponentialMovingAverage ema(0.5);
    assert(near(ema.push(2.0), 2.0));
    assert(near(ema.push(4.0), 3.0));

    PeakHold peak;
    assert(near(peak.push(-2.0), -2.0));
    assert(near(peak.push(-3.0), -2.0));
    assert(near(peak.push(5.0), 5.0));

    ThresholdTrigger trigger(5.0);
    assert(!trigger.update(4.9));
    assert(trigger.update(5.1));
    assert(trigger.update(6.0));
    trigger.reset();
    assert(trigger.update(8.0));

    HysteresisLatch latch(2.0, 4.0);
    assert(!latch.update(3.0));
    assert(latch.update(4.1));
    assert(latch.update(3.0));
    assert(!latch.update(1.9));

    RingBuffer<int, 3> buffer;
    buffer.push(1); buffer.push(2); buffer.push(3);
    assert(buffer.size() == 3U);
    assert(buffer[0] == 1 && buffer[2] == 3);
    buffer.push(4);
    assert(buffer[0] == 2 && buffer[2] == 4);

    Sample<double> sample;
    sample.timestampUs = 1234U;
    sample.value = 9.5;
    sample.valid = true;
    assert(sample.timestampUs == 1234U && near(sample.value, 9.5) && sample.valid);

    PeriodicSampler sampler(100U);
    assert(sampler.ready(1000U));
    assert(!sampler.ready(1050U));
    assert(sampler.ready(1100U));
    assert(sampler.ready(1400U));
    assert(!sampler.ready(1401U));

    ManualClock clock(1000U);
    assert(clock.micros() == 1000U);
    clock.advanceMicros(250U);
    assert(clock.micros() == 1250U);
    clock.setMicros(42U);
    assert(clock.micros() == 42U);

    SampleClock sample_clock(100U);
    const auto first_timing = sample_clock.observe(1000U);
    assert(first_timing.sample_dt_us == 0U);
    assert(!first_timing.late);
    const auto on_time = sample_clock.observe(1100U);
    assert(on_time.sample_dt_us == 100U);
    assert(on_time.lateness_us == 0U);
    assert(!on_time.late);
    const auto late = sample_clock.observe(1270U);
    assert(late.sample_dt_us == 170U);
    assert(late.lateness_us == 70U);
    assert(late.late);

    const auto good = AcquisitionResult<float>::success(3.25f, 5000U, 80U);
    assert(good.ok());
    assert(near(good.value, 3.25));
    assert(good.timestamp_us == 5000U);
    assert(good.read_duration_us == 80U);

    const auto timeout = AcquisitionResult<float>::failure(
        AcquisitionStatus::Timeout, 5100U, 100U);
    assert(!timeout.ok());
    assert(timeout.status == AcquisitionStatus::Timeout);

    FakeSensor<float, 3> fake;
    assert(fake.push(good));
    assert(fake.push(timeout));
    assert(fake.remaining() == 2U);
    const auto fake_good = fake.read();
    assert(fake_good.ok() && near(fake_good.value, 3.25));
    const auto fake_timeout = fake.read();
    assert(fake_timeout.status == AcquisitionStatus::Timeout);
    const auto exhausted = fake.read();
    assert(exhausted.status == AcquisitionStatus::NotReady);
    fake.reset();
    assert(fake.remaining() == 2U);

    const EvidenceRecord good_record = makeEvidenceRecord(7U, 100U, good);
    assert(good_record.sequence_id == 7U);
    assert(good_record.timestamp_us == 5000U);
    assert(good_record.read_duration_us == 80U);
    assert(good_record.usable());
    assert(good_record.quality_flags == betterboard::experiments::evidence::Valid);

    const EvidenceRecord timeout_record = makeEvidenceRecord(8U, 100U, timeout);
    assert(!timeout_record.usable());
    assert(betterboard::experiments::evidence::hasFlag(
        timeout_record.quality_flags,
        betterboard::experiments::evidence::SensorError));

    const auto saturated = AcquisitionResult<int>::failure(
        AcquisitionStatus::Saturated, 5200U, 20U);
    const EvidenceRecord saturated_record = makeEvidenceRecord(9U, 100U, saturated);
    assert(betterboard::experiments::evidence::hasFlag(
        saturated_record.quality_flags,
        betterboard::experiments::evidence::Saturated));

    return 0;
}
