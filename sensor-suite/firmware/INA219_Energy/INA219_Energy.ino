#include <Wire.h>
#include <Adafruit_INA219.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif

Adafruit_INA219 ina219;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::TrapezoidIntegrator energy_mj;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) while (true) delay(1000);
  sampler.reset(micros());
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const float bus_v = ina219.getBusVoltage_V();
  const float shunt_mv = ina219.getShuntVoltage_mV();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();
  const double time_s = static_cast<double>(now) * 1.0e-6;
  energy_mj.push(time_s, static_cast<double>(power_mw));

  Serial.print(now); Serial.print(',');
  Serial.print(bus_v, 6); Serial.print(',');
  Serial.print(shunt_mv, 6); Serial.print(',');
  Serial.print(current_ma, 6); Serial.print(',');
  Serial.print(power_mw, 6); Serial.print(',');
  Serial.println(energy_mj.value(), 6);
}
