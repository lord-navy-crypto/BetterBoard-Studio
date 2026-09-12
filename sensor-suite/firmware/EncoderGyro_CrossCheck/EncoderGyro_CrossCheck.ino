#include <Wire.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_Sensor.h>
Adafruit_LSM6DSOX imu;
volatile long encoder_count = 0;
constexpr uint8_t ENC_A = 2;
constexpr uint8_t ENC_B = 3;
#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600.0
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif
void onA(){ encoder_count += (digitalRead(ENC_A) == digitalRead(ENC_B)) ? 1 : -1; }
unsigned long last_us = 0;
float gyro_angle_deg = 0.0f;
void setup(){
  Serial.begin(115200);
  pinMode(ENC_A, INPUT_PULLUP); pinMode(ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onA, CHANGE);
  if(!imu.begin_I2C()) while(true) delay(100);
  last_us = micros();
}
void loop(){
  const unsigned long now = micros();
  const unsigned long dt_us = now - last_us;
  if(dt_us < BB_SAMPLE_INTERVAL_US) return;
  last_us = now;
  sensors_event_t accel, gyro, temp; imu.getEvent(&accel,&gyro,&temp);
  noInterrupts(); long count = encoder_count; interrupts();
  const float encoder_deg = 360.0f * (float)count / (float)BB_COUNTS_PER_REVOLUTION;
  gyro_angle_deg += gyro.gyro.z * ((float)dt_us * 1.0e-6f) * 57.2957795f;
  const float disagreement = gyro_angle_deg - encoder_deg;
  Serial.print(now); Serial.print(','); Serial.print(count); Serial.print(','); Serial.print(encoder_deg,5); Serial.print(','); Serial.print(gyro.gyro.z,6); Serial.print(','); Serial.print(gyro_angle_deg,5); Serial.print(','); Serial.println(disagreement,5);
}
