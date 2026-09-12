#pragma once

namespace betterboard {
namespace signal {

class PeakHold {
public:
    PeakHold();

    void reset();
    double push(double sample);
    bool initialized() const;
    double peak() const;

private:
    double peak_;
    bool initialized_;
};

}  // namespace signal
}  // namespace betterboard
