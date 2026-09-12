#include <Wire.h>
#include <Adafruit_INA219.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif

Adafruit_INA219 ina219;
unsigned long last_sample_us = 0;
float previous_power_mw = 0.0f;
double energy_mj = 0.0;
bool have_previous = false;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) while (true) delay(1000);
}

void loop() {
  const unsigned long now = micros();
  const unsigned long elapsed = now - last_sample_us;
  if (elapsed < (unsigned long)BB_SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  const float bus_v = ina219.getBusVoltage_V();
  const float shunt_mv = ina219.getShuntVoltage_mV();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();
  const float dt_s = elapsed * 1.0e-6f;
  if (have_previous) energy_mj += 0.5 * (previous_power_mw + power_mw) * dt_s;
  else have_previous = true;
  previous_power_mw = power_mw;

  Serial.print(now); Serial.print(',');
  Serial.print(bus_v, 6); Serial.print(',');
  Serial.print(shunt_mv, 6); Serial.print(',');
  Serial.print(current_ma, 6); Serial.print(',');
  Serial.print(power_mw, 6); Serial.print(',');
  Serial.println(energy_mj, 6);
}
