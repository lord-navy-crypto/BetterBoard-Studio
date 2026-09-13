#include <Wire.h>
#include <Adafruit_INA219.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif

Adafruit_INA219 ina219;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::TrapezoidIntegrator energy;
betterboard::experiments::EngineeringLabStream stream(Serial);
unsigned long previous_sample_us = 0;

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(180);
    digitalWrite(LED_BUILTIN, LOW); delay(180);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!ina219.begin()) failSensor();
  sampler.arm(micros());
  stream.begin("el-power-context-ina219",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,bus_v,current_ma,power_mw,energy_mj,integration_dt_us,read_duration_us,quality_flags",
               "us,V,mA,mW,mJ,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;sensor=INA219;energy_method=trapezoid;timebase=actual_sample_time");
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const unsigned long integration_dt_us = previous_sample_us == 0 ? 0 : now - previous_sample_us;
  previous_sample_us = now;
  uint16_t quality = betterboard::experiments::evidence::Valid;
  if (integration_dt_us != 0 && integration_dt_us > BB_SAMPLE_INTERVAL_US + BB_SAMPLE_INTERVAL_US / 2) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::TimingLate);
  }

  const unsigned long read_start_us = micros();
  const float bus_v = ina219.getBusVoltage_V();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();
  const unsigned long read_duration_us = micros() - read_start_us;

  const bool valid = isfinite(bus_v) && isfinite(current_ma) && isfinite(power_mw);
  if (!valid) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::SensorError);
  } else {
    energy.push(now * 1.0e-6, power_mw);
  }
  if (integration_dt_us == 0) {
    quality = betterboard::experiments::evidence::addFlag(
        quality, betterboard::experiments::evidence::DerivedUnavailable);
  }

  stream.rowBegin(now);
  if (valid) {
    stream.field(bus_v, 6); stream.field(current_ma, 6); stream.field(power_mw, 6); stream.field(energy.value(), 6);
  } else {
    stream.field(""); stream.field(""); stream.field(""); stream.field("");
  }
  stream.field(integration_dt_us); stream.field(read_duration_us);
  stream.field(static_cast<unsigned long>(quality));
  stream.rowEnd();
}
