#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_LSM6DSOX.h>
#include <Adafruit_VL53L1X.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000UL
#endif

struct MotionSample {
  float distance_m{0.0f};
  float ax_mps2{0.0f};
  float ay_mps2{0.0f};
  float az_mps2{0.0f};
  float gx_rps{0.0f};
  float gy_rps{0.0f};
  float gz_rps{0.0f};
  uint32_t sensor_skew_us{0U};
};

Adafruit_LSM6DSOX imu;
Adafruit_VL53L1X tof;
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
  if (!imu.begin_I2C()) failSensor();
  if (!tof.begin(0x29, &Wire)) failSensor();
  if (!tof.startRanging()) failSensor();
  sampler.arm(micros());
  stream.begin("el-oscillation-imu-tof",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,distance_m,ax_mps2,ay_mps2,az_mps2,gx_rps,gy_rps,gz_rps,sample_dt_us,sensor_skew_us,read_duration_us,quality_flags",
               "us,m,m/s^2,m/s^2,m/s^2,rad/s,rad/s,rad/s,us,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;imu=LSM6DSOX;tof=VL53L1X;tof_address=0x29;acquisition=sequential");
}

void loop() {
  const uint32_t now = micros();
  if (!sampler.ready(now) || !tof.dataReady()) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t base_quality = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    base_quality = betterboard::experiments::evidence::addFlag(
        base_quality, betterboard::experiments::evidence::TimingLate);
  }

  const uint32_t read_start_us = micros();
  const int16_t distance_mm = tof.distance();
  tof.clearInterrupt();
  const uint32_t tof_done_us = micros();

  sensors_event_t a, g, temp;
  imu.getEvent(&a, &g, &temp);
  const uint32_t imu_done_us = micros();

  MotionSample sample;
  sample.distance_m = float(distance_mm) / 1000.0f;
  sample.ax_mps2 = a.acceleration.x;
  sample.ay_mps2 = a.acceleration.y;
  sample.az_mps2 = a.acceleration.z;
  sample.gx_rps = g.gyro.x;
  sample.gy_rps = g.gyro.y;
  sample.gz_rps = g.gyro.z;
  sample.sensor_skew_us = imu_done_us - tof_done_us;
  const uint32_t read_duration_us = imu_done_us - read_start_us;

  const bool imu_valid = isfinite(sample.ax_mps2) && isfinite(sample.ay_mps2) &&
                         isfinite(sample.az_mps2) && isfinite(sample.gx_rps) &&
                         isfinite(sample.gy_rps) && isfinite(sample.gz_rps);
  const bool distance_valid = distance_mm >= 0;
  const betterboard::measurement::AcquisitionResult<MotionSample> result =
      (distance_valid && imu_valid)
          ? betterboard::measurement::AcquisitionResult<MotionSample>::success(
                sample, now, read_duration_us)
          : betterboard::measurement::AcquisitionResult<MotionSample>::failure(
                betterboard::measurement::AcquisitionStatus::InvalidValue,
                now, read_duration_us);

  const betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          sequence_id++, timing.sample_dt_us, result, base_quality);

  stream.rowBegin(record.timestamp_us);
  if (distance_valid) stream.field(sample.distance_m, 6); else stream.field("");
  if (imu_valid) {
    stream.field(sample.ax_mps2, 6); stream.field(sample.ay_mps2, 6); stream.field(sample.az_mps2, 6);
    stream.field(sample.gx_rps, 7); stream.field(sample.gy_rps, 7); stream.field(sample.gz_rps, 7);
  } else {
    stream.field(""); stream.field(""); stream.field("");
    stream.field(""); stream.field(""); stream.field("");
  }
  stream.field(record.sample_dt_us); stream.field(sample.sensor_skew_us); stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
