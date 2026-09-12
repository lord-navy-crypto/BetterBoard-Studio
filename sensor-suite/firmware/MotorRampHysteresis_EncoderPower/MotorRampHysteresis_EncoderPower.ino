#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

#ifndef BB_ENCODER_A
#define BB_ENCODER_A 2
#endif
#ifndef BB_ENCODER_B
#define BB_ENCODER_B 3
#endif
#ifndef BB_MOTOR_PWM
#define BB_MOTOR_PWM 5
#endif
#ifndef BB_MOTOR_IN1
#define BB_MOTOR_IN1 6
#endif
#ifndef BB_MOTOR_IN2
#define BB_MOTOR_IN2 7
#endif
#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0f
#endif
#ifndef BB_MAX_PWM
#define BB_MAX_PWM 120
#endif
#ifndef BB_PWM_STEP
#define BB_PWM_STEP 20
#endif
#ifndef BB_DWELL_MS
#define BB_DWELL_MS 800UL
#endif

Adafruit_INA219 ina219;
volatile long encoderCount = 0;
static long lastCount = 0;
static unsigned long lastReportUs = 0;
static unsigned long stepStartedMs = 0;
static int pwmCommand = 0;
static int direction = 1;

void onEncoderA() {
  const bool a = digitalRead(BB_ENCODER_A);
  const bool b = digitalRead(BB_ENCODER_B);
  encoderCount += (a == b) ? 1 : -1;
}

void applyMotor(int pwm) {
  digitalWrite(BB_MOTOR_IN1, HIGH);
  digitalWrite(BB_MOTOR_IN2, LOW);
  analogWrite(BB_MOTOR_PWM, pwm);
}

void setup() {
  Serial.begin(115200);
  pinMode(BB_ENCODER_A, INPUT_PULLUP);
  pinMode(BB_ENCODER_B, INPUT_PULLUP);
  pinMode(BB_MOTOR_PWM, OUTPUT);
  pinMode(BB_MOTOR_IN1, OUTPUT);
  pinMode(BB_MOTOR_IN2, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(BB_ENCODER_A), onEncoderA, CHANGE);
  if (!ina219.begin()) while (true) delay(100);
  applyMotor(0);
  stepStartedMs = millis();
  lastReportUs = micros();
}

void loop() {
  const unsigned long nowMs = millis();
  if (nowMs - stepStartedMs >= BB_DWELL_MS) {
    stepStartedMs = nowMs;
    pwmCommand += direction * BB_PWM_STEP;
    if (pwmCommand >= BB_MAX_PWM) { pwmCommand = BB_MAX_PWM; direction = -1; }
    if (pwmCommand <= 0) { pwmCommand = 0; direction = 1; }
    applyMotor(pwmCommand);
  }

  const unsigned long nowUs = micros();
  if ((unsigned long)(nowUs - lastReportUs) < 100000UL) return;
  const float dt = (float)(nowUs - lastReportUs) / 1000000.0f;
  lastReportUs = nowUs;
  noInterrupts();
  const long count = encoderCount;
  interrupts();
  const long dc = count - lastCount;
  lastCount = count;
  const float rpm = dt > 0.0f ? ((float)dc / BB_COUNTS_PER_REVOLUTION) * (60.0f / dt) : 0.0f;

  Serial.print(nowMs); Serial.print(',');
  Serial.print(pwmCommand); Serial.print(',');
  Serial.print(direction); Serial.print(',');
  Serial.print(rpm, 4); Serial.print(',');
  Serial.print(ina219.getCurrent_mA(), 4); Serial.print(',');
  Serial.println(ina219.getPower_mW(), 4);
}
