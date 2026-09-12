#pragma once

#include <stddef.h>

namespace betterboard {
namespace core {

template <typename T, size_t Capacity>
class RingBuffer {
public:
    RingBuffer() : start_(0U), size_(0U) {
        static_assert(Capacity > 0U, "RingBuffer capacity must be greater than zero");
    }

    void clear() {
        start_ = 0U;
        size_ = 0U;
    }

    void push(const T& value) {
        if (size_ < Capacity) {
            data_[(start_ + size_) % Capacity] = value;
            ++size_;
            return;
        }

        data_[start_] = value;
        start_ = (start_ + 1U) % Capacity;
    }

    size_t size() const { return size_; }
    constexpr size_t capacity() const { return Capacity; }
    bool empty() const { return size_ == 0U; }
    bool full() const { return size_ == Capacity; }

    const T& operator[](size_t index) const {
        return data_[(start_ + index) % Capacity];
    }

    T& operator[](size_t index) {
        return data_[(start_ + index) % Capacity];
    }

    const T& oldest() const { return (*this)[0U]; }
    const T& newest() const { return (*this)[size_ - 1U]; }

private:
    T data_[Capacity];
    size_t start_;
    size_t size_;
};

}  // namespace core
}  // namespace betterboard
