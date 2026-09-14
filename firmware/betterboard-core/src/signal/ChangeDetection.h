#pragma once

#include <math.h>
#include <stddef.h>

namespace betterboard { namespace signal {

class EwmaMonitor {
public:
    explicit EwmaMonitor(double alpha = 0.2) : alpha_(alpha), initialized_(false), value_(0.0) {}
    void reset() { initialized_ = false; value_ = 0.0; }
    double push(double x) {
        if (!initialized_) { value_ = x; initialized_ = true; }
        else value_ = alpha_ * x + (1.0 - alpha_) * value_;
        return value_;
    }
    double value() const { return value_; }
    bool initialized() const { return initialized_; }
private:
    double alpha_;
    bool initialized_;
    double value_;
};

class CusumDetector {
public:
    CusumDetector(double reference_mean, double slack, double threshold)
        : mean_(reference_mean), slack_(slack), threshold_(threshold) { reset(); }
    void reset() { positive_ = 0.0; negative_ = 0.0; }
    bool update(double x) {
        positive_ = fmax(0.0, positive_ + (x - mean_) - slack_);
        negative_ = fmin(0.0, negative_ + (x - mean_) + slack_);
        return positive_ > threshold_ || -negative_ > threshold_;
    }
    double positiveScore() const { return positive_; }
    double negativeScore() const { return negative_; }
private:
    double mean_, slack_, threshold_;
    double positive_, negative_;
};

template <size_t N>
class WindowMeanShift {
public:
    static_assert(N >= 4 && (N % 2) == 0, "WindowMeanShift requires an even N >= 4");
    WindowMeanShift() { reset(); }
    void reset() { count_ = 0; head_ = 0; for (size_t i = 0; i < N; ++i) data_[i] = 0.0; }
    void push(double x) {
        data_[head_] = x;
        head_ = (head_ + 1) % N;
        if (count_ < N) ++count_;
    }
    bool ready() const { return count_ == N; }
    double meanShift() const {
        if (!ready()) return NAN;
        double first = 0.0, second = 0.0;
        for (size_t i = 0; i < N / 2; ++i) {
            first += atChronological(i);
            second += atChronological(i + N / 2);
        }
        return second / static_cast<double>(N / 2) - first / static_cast<double>(N / 2);
    }
    bool exceeds(double absolute_threshold) const {
        const double shift = meanShift();
        return isfinite(shift) && fabs(shift) > absolute_threshold;
    }
private:
    double atChronological(size_t i) const { return data_[(head_ + i) % N]; }
    double data_[N];
    size_t count_, head_;
};

}} // namespace betterboard::signal
