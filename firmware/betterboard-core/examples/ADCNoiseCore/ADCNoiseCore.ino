#include <BetterBoard.h>

using betterboard::core::PeriodicSampler;
using betterboard::math::OnlineStatistics;

PeriodicSampler sampler(1000U);
OnlineStatistics window_stats;

static const uint8_t kAnalogPin = A0;
static const uint16_t kWindow = 128U;

void setup() {
    Serial.begin(115200);
}

void loop() {
    const uint32_t now_us = micros();
    if (!sampler.ready(now_us)) return;

    const int raw = analogRead(kAnalogPin);
    window_stats.push(static_cast<double>(raw));

    if (window_stats.count() >= kWindow) {
        Serial.print(now_us);
        Serial.print(',');
        Serial.print(window_stats.mean(), 6);
        Serial.print(',');
        Serial.print(window_stats.standardDeviationPopulation(), 6);
        Serial.print(',');
        Serial.print(window_stats.minimum(), 6);
        Serial.print(',');
        Serial.println(window_stats.maximum(), 6);
        window_stats.reset();
    }
}
