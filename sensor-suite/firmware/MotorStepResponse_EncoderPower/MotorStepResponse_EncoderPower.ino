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
#ifndef BB_STEP_PWM
#define BB_STEP_PWM 100
#endif
#ifndef BB_STEP_DELAY_MS
#define BB_STEP_DELAY_MS 1000UL
#endif
#ifndef BB_RUN_MS
#define BB_RUN_MS 3000UL
#endif

Adafruit_INA219 ina219;
volatile long encoderCount = 0;
static long lastCount = 0;
static unsigned long lastReportUs = 0;
static unsigned long startMs = 0;
static bool running = false;

void onEncoderA() {
  const bool a = digitalRead(BB_ENCODER_A);
  const bool b = digitalRead(BB_ENCODER_B);
  encoderCount += (a == b) ? 1 : -1;
}

void setMotor(int pwm) {
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
  setMotor(0);
  startMs = millis();
  lastReportUs = micros();
}

void loop() {
  const unsigned long nowMs = millis();
  if (!running && nowMs - startMs >= BB_STEP_DELAY_MS && nowMs - startMs < BB_STEP_DELAY_MS + BB_RUN_MS) {
    setMotor(BB_STEP_PWM);
    running = true;
  }
  if (running && nowMs - startMs >= BB_STEP_DELAY_MS + BB_RUN_MS) {
    setMotor(0);
    running = false;
  }

  const unsigned long nowUs = micros();
  if ((unsigned long)(nowUs - lastReportUs) < 50000UL) return;
  const float dt = (float)(nowUs - lastReportUs) / 1000000.0f;
  lastReportUs = nowUs;
  noInterrupts();
  const long count = encoderCount;
  interrupts();
  const long dc = count - lastCount;
  lastCount = count;
  const float rpm = dt > 0.0f ? ((float)dc / BB_COUNTS_PER_REVOLUTION) * (60.0f / dt) : 0.0f;
  const float currentMa = ina219.getCurrent_mA();
  const float powerMw = ina219.getPower_mW();

  Serial.print(nowMs); Serial.print(',');
  Serial.print(running ? BB_STEP_PWM : 0); Serial.print(',');
  Serial.print(count); Serial.print(',');
  Serial.print(rpm, 4); Serial.print(',');
  Serial.print(currentMa, 4); Serial.print(',');
  Serial.println(powerMw, 4);
}
