#include <Wire.h>
#include <Adafruit_INA219.h>

#ifndef BB_PWM_PIN
#define BB_PWM_PIN 5
#endif
#ifndef BB_IN1_PIN
#define BB_IN1_PIN 4
#endif
#ifndef BB_IN2_PIN
#define BB_IN2_PIN 7
#endif
#ifndef BB_STBY_PIN
#define BB_STBY_PIN 8
#endif
#ifndef BB_MAX_PWM
#define BB_MAX_PWM 120
#endif
#ifndef BB_PWM_STEP
#define BB_PWM_STEP 20
#endif
#ifndef BB_DWELL_MS
#define BB_DWELL_MS 750
#endif

Adafruit_INA219 ina219;

namespace {
int command_pwm = 0;
int direction_sign = 1;
unsigned long last_step_ms = 0;

void stopMotor() {
  analogWrite(BB_PWM_PIN, 0);
  digitalWrite(BB_IN1_PIN, LOW);
  digitalWrite(BB_IN2_PIN, LOW);
}

void applyMotor(int pwm, int dir) {
  digitalWrite(BB_STBY_PIN, HIGH);
  digitalWrite(BB_IN1_PIN, dir >= 0 ? HIGH : LOW);
  digitalWrite(BB_IN2_PIN, dir >= 0 ? LOW : HIGH);
  analogWrite(BB_PWM_PIN, constrain(pwm, 0, 255));
}
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(BB_PWM_PIN, OUTPUT);
  pinMode(BB_IN1_PIN, OUTPUT);
  pinMode(BB_IN2_PIN, OUTPUT);
  pinMode(BB_STBY_PIN, OUTPUT);
  digitalWrite(BB_STBY_PIN, LOW);
  stopMotor();
  if (!ina219.begin()) {
    while (true) {
      stopMotor();
      delay(250);
    }
  }
}

void loop() {
  const unsigned long now_ms = millis();
  if ((unsigned long)(now_ms - last_step_ms) < (unsigned long)BB_DWELL_MS) return;
  last_step_ms = now_ms;

  applyMotor(command_pwm, direction_sign);
  delay(120);

  const float bus_v = ina219.getBusVoltage_V();
  const float shunt_mv = ina219.getShuntVoltage_mV();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();
  const float load_v = bus_v + shunt_mv / 1000.0f;

  // time_ms,pwm_command,direction,bus_voltage_v,load_voltage_v,current_ma,power_mw
  Serial.print(now_ms);
  Serial.print(','); Serial.print(command_pwm);
  Serial.print(','); Serial.print(direction_sign);
  Serial.print(','); Serial.print(bus_v, 6);
  Serial.print(','); Serial.print(load_v, 6);
  Serial.print(','); Serial.print(current_ma, 6);
  Serial.print(','); Serial.println(power_mw, 6);

  command_pwm += BB_PWM_STEP;
  if (command_pwm > BB_MAX_PWM) {
    command_pwm = 0;
    direction_sign = -direction_sign;
    stopMotor();
  }
}
