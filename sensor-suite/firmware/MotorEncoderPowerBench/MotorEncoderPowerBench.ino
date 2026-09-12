#include <Wire.h>
#include <Adafruit_INA219.h>

#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#endif
#ifndef BB_MAX_PWM
#define BB_MAX_PWM 100
#endif
#ifndef BB_DWELL_MS
#define BB_DWELL_MS 1500UL
#endif

const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;
const uint8_t MOTOR_IN1 = 4;
const uint8_t MOTOR_PWM = 5;
const uint8_t MOTOR_IN2 = 7;
const uint8_t MOTOR_STBY = 8;

Adafruit_INA219 ina219;
volatile long encoder_count = 0;
unsigned long phase_started_ms = 0;
long phase_start_count = 0;
uint8_t phase = 0;
const uint8_t pwm_levels[] = {0, 40, 60, 80, BB_MAX_PWM, 0};
const uint8_t phase_count = sizeof(pwm_levels) / sizeof(pwm_levels[0]);

void onEncoderA() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a == b) ? 1 : -1;
}

void setMotor(uint8_t pwm) {
  digitalWrite(MOTOR_STBY, HIGH);
  digitalWrite(MOTOR_IN1, HIGH);
  digitalWrite(MOTOR_IN2, LOW);
  analogWrite(MOTOR_PWM, pwm);
}

void stopMotor() {
  analogWrite(MOTOR_PWM, 0);
  digitalWrite(MOTOR_STBY, LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_PWM, OUTPUT);
  pinMode(MOTOR_STBY, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onEncoderA, CHANGE);
  stopMotor();
  if (!ina219.begin()) while (true) delay(1000);
  phase_started_ms = millis();
  setMotor(pwm_levels[phase]);
}

void loop() {
  const unsigned long now_ms = millis();
  if ((unsigned long)(now_ms - phase_started_ms) < (unsigned long)BB_DWELL_MS) return;

  noInterrupts();
  const long count = encoder_count;
  interrupts();
  const long delta_count = count - phase_start_count;
  const float dt_s = (now_ms - phase_started_ms) * 0.001f;
  const float revolutions = delta_count / (float)BB_COUNTS_PER_REVOLUTION;
  const float rpm = dt_s > 0.0f ? revolutions * 60.0f / dt_s : 0.0f;
  const float bus_v = ina219.getBusVoltage_V();
  const float current_ma = ina219.getCurrent_mA();
  const float power_mw = ina219.getPower_mW();

  Serial.print(now_ms); Serial.print(',');
  Serial.print(pwm_levels[phase]); Serial.print(',');
  Serial.print(count); Serial.print(',');
  Serial.print(rpm, 5); Serial.print(',');
  Serial.print(bus_v, 5); Serial.print(',');
  Serial.print(current_ma, 5); Serial.print(',');
  Serial.println(power_mw, 5);

  phase_start_count = count;
  phase_started_ms = now_ms;
  phase = (phase + 1) % phase_count;
  if (pwm_levels[phase] == 0) stopMotor();
  else setMotor(pwm_levels[phase]);
}
