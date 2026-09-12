#include <Wire.h>
#include <Adafruit_INA219.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif

Adafruit_INA219 ina219;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::math::TrapezoidIntegrator energy;
betterboard::experiments::EngineeringLabStream stream(Serial);

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
               "time_us,bus_v,current_ma,power_mw,energy_mj",
               "us,V,mA,mW,mJ",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const float bus_v = ina219.getBusVoltage_V();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();
  energy.push(now * 1.0e-6, power_mw);

  stream.rowBegin(now);
  stream.field(bus_v, 6); stream.field(current_ma, 6); stream.field(power_mw, 6); stream.field(energy.value(), 6);
  stream.rowEnd();
}
