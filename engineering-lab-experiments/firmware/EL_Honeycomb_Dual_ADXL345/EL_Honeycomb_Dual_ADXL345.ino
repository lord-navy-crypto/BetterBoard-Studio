#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000UL
#endif

struct DualAccelSample {
  float a1_x_mps2{0.0f};
  float a1_y_mps2{0.0f};
  float a1_z_mps2{0.0f};
  float a2_x_mps2{0.0f};
  float a2_y_mps2{0.0f};
  float a2_z_mps2{0.0f};
  uint32_t sensor_skew_us{0U};
};

Adafruit_ADXL345_Unified accel1(34501);
Adafruit_ADXL345_Unified accel2(34502);
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0U;

void failSensor() {
  pinMode(LED_BUILTIN, OUTPUT);
  while (true) {
    digitalWrite(LED_BUILTIN, HIGH); delay(120);
    digitalWrite(LED_BUILTIN, LOW); delay(120);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!accel1.begin(0x53)) failSensor();
  if (!accel2.begin(0x1D)) failSensor();
  accel1.setRange(ADXL345_RANGE_16_G);
  accel2.setRange(ADXL345_RANGE_16_G);
  sampler.arm(micros());
  stream.begin("el-honeycomb-dual-adxl345",
               betterboard::experiments::target::MULTILAYER_HONEYCOMB_LATTICE,
               "time_us,a1_x_mps2,a1_y_mps2,a1_z_mps2,a2_x_mps2,a2_y_mps2,a2_z_mps2,sample_dt_us,sensor_skew_us,read_duration_us,quality_flags",
               "us,m/s^2,m/s^2,m/s^2,m/s^2,m/s^2,m/s^2,us,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;adxl1_address=0x53;adxl2_address=0x1D;range=16g;acquisition=sequential");
}

void loop() {
  const uint32_t now = micros();
  if (!sampler.ready(now)) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t base_quality = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    base_quality = betterboard::experiments::evidence::addFlag(
        base_quality, betterboard::experiments::evidence::TimingLate);
  }

  const uint32_t read_start_us = micros();
  sensors_event_t e1, e2;
  accel1.getEvent(&e1);
  const uint32_t a1_done_us = micros();
  accel2.getEvent(&e2);
  const uint32_t a2_done_us = micros();

  DualAccelSample sample;
  sample.a1_x_mps2 = e1.acceleration.x;
  sample.a1_y_mps2 = e1.acceleration.y;
  sample.a1_z_mps2 = e1.acceleration.z;
  sample.a2_x_mps2 = e2.acceleration.x;
  sample.a2_y_mps2 = e2.acceleration.y;
  sample.a2_z_mps2 = e2.acceleration.z;
  sample.sensor_skew_us = a2_done_us - a1_done_us;
  const uint32_t read_duration_us = a2_done_us - read_start_us;

  const bool valid = isfinite(sample.a1_x_mps2) && isfinite(sample.a1_y_mps2) &&
                     isfinite(sample.a1_z_mps2) && isfinite(sample.a2_x_mps2) &&
                     isfinite(sample.a2_y_mps2) && isfinite(sample.a2_z_mps2);
  const betterboard::measurement::AcquisitionResult<DualAccelSample> result =
      valid
          ? betterboard::measurement::AcquisitionResult<DualAccelSample>::success(
                sample, now, read_duration_us)
          : betterboard::measurement::AcquisitionResult<DualAccelSample>::failure(
                betterboard::measurement::AcquisitionStatus::InvalidValue,
                now, read_duration_us);

  const betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          sequence_id++, timing.sample_dt_us, result, base_quality);

  stream.rowBegin(record.timestamp_us);
  if (valid) {
    stream.field(sample.a1_x_mps2, 6); stream.field(sample.a1_y_mps2, 6); stream.field(sample.a1_z_mps2, 6);
    stream.field(sample.a2_x_mps2, 6); stream.field(sample.a2_y_mps2, 6); stream.field(sample.a2_z_mps2, 6);
  } else {
    stream.field(""); stream.field(""); stream.field("");
    stream.field(""); stream.field(""); stream.field("");
  }
  stream.field(record.sample_dt_us); stream.field(sample.sensor_skew_us); stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
