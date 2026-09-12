#include <Wire.h>
#include <Adafruit_INA219.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000
#endif

Adafruit_INA219 ina219;

namespace {
constexpr unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(220);
    digitalWrite(LED_BUILTIN, LOW);
    delay(220);
  }
}
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!ina219.begin()) sensorFail();
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  const float bus_v = ina219.getBusVoltage_V();
  const float shunt_mv = ina219.getShuntVoltage_mV();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();
  const float load_v = bus_v + shunt_mv / 1000.0f;

  // time_us,bus_voltage_v,shunt_voltage_mv,load_voltage_v,current_ma,power_mw
  Serial.print(now);
  Serial.print(','); Serial.print(bus_v, 6);
  Serial.print(','); Serial.print(shunt_mv, 6);
  Serial.print(','); Serial.print(load_v, 6);
  Serial.print(','); Serial.print(current_ma, 6);
  Serial.print(','); Serial.println(power_mw, 6);
}
