#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(34501);

const unsigned long SAMPLE_INTERVAL_US = 10000UL; // 100 Hz

// 0 = ax, 1 = ay, 2 = az
const uint8_t PRIMARY_AXIS = 2;

unsigned long last_sample_us = 0;

float primaryAcceleration(float ax, float ay, float az) {
  if (PRIMARY_AXIS == 0) return ax;
  if (PRIMARY_AXIS == 1) return ay;
  return az;
}

void sensorFail() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(150);
    digitalWrite(LED_BUILTIN, LOW);
    delay(150);
  }
}

void setup() {
  Serial.begin(115200);

  if (!accel.begin()) {
    sensorFail();
  }

  accel.setRange(ADXL345_RANGE_16_G);
  accel.setDataRate(ADXL345_DATARATE_100_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  sensors_event_t event;
  accel.getEvent(&event);

  const float ax = event.acceleration.x;
  const float ay = event.acceleration.y;
  const float az = event.acceleration.z;
  const float primary = primaryAcceleration(ax, ay, az);

  // time_us,ax_mps2,ay_mps2,az_mps2,primary_mps2
  Serial.print(now);
  Serial.print(',');
  Serial.print(ax, 5);
  Serial.print(',');
  Serial.print(ay, 5);
  Serial.print(',');
  Serial.print(az, 5);
  Serial.print(',');
  Serial.println(primary, 5);
}
