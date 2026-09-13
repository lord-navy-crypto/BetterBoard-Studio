#include <Wire.h>
#include <Adafruit_MLX90393.h>
#include <BetterBoard.h>
#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 50000UL
#endif

struct MagneticSample {
  float x;
  float y;
  float z;
};

Adafruit_MLX90393 mag;
betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::core::SampleClock sample_clock(BB_SAMPLE_INTERVAL_US);
betterboard::experiments::EngineeringLabStream stream(Serial);
uint32_t sequence_id = 0;

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
  if (!mag.begin_I2C()) failSensor();
  sampler.reset(micros());
  stream.begin("el-radia-mlx90393-field",
               betterboard::experiments::target::RADIA_MAGNET_STUDIO,
               "time_us,bx_uT,by_uT,bz_uT,bmag_uT,bxy_uT,azimuth_rad,elevation_rad,sample_dt_us,read_duration_us,quality_flags",
               "us,uT,uT,uT,uT,uT,rad,rad,us,us,bitmask",
               BB_SAMPLE_INTERVAL_US,
               "schema=v2;frame=sensor;mlx90393_transport=i2c;derived=bxy|azimuth|elevation;acquisition_contract=v3");
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const betterboard::core::SampleTiming timing = sample_clock.observe(now);
  uint16_t flags = betterboard::experiments::evidence::Valid;
  if (timing.late) {
    flags = betterboard::experiments::evidence::addFlag(
        flags, betterboard::experiments::evidence::TimingLate);
  }

  const unsigned long read_start_us = micros();
  MagneticSample sample;
  const bool ok = mag.readData(&sample.x, &sample.y, &sample.z);
  const unsigned long read_duration_us = micros() - read_start_us;

  betterboard::measurement::AcquisitionResult<MagneticSample> acquisition;
  if (ok && isfinite(sample.x) && isfinite(sample.y) && isfinite(sample.z)) {
    acquisition = betterboard::measurement::AcquisitionResult<MagneticSample>::success(
        sample, now, read_duration_us);
  } else {
    acquisition = betterboard::measurement::AcquisitionResult<MagneticSample>::failure(
        ok ? betterboard::measurement::AcquisitionStatus::InvalidValue
           : betterboard::measurement::AcquisitionStatus::BusError,
        now,
        read_duration_us);
  }

  const betterboard::experiments::EvidenceRecord record =
      betterboard::experiments::makeEvidenceRecord(
          ++sequence_id, timing.sample_dt_us, acquisition, flags);

  stream.rowBegin(record.timestamp_us);
  if (!record.usable()) {
    stream.field(""); stream.field(""); stream.field(""); stream.field("");
    stream.field(""); stream.field(""); stream.field("");
  } else {
    const float bxy = sqrtf(acquisition.value.x * acquisition.value.x +
                            acquisition.value.y * acquisition.value.y);
    const float bmag = sqrtf(bxy * bxy + acquisition.value.z * acquisition.value.z);
    const float azimuth = atan2f(acquisition.value.y, acquisition.value.x);
    const float elevation = atan2f(acquisition.value.z, bxy);
    stream.field(acquisition.value.x, 4);
    stream.field(acquisition.value.y, 4);
    stream.field(acquisition.value.z, 4);
    stream.field(bmag, 4);
    stream.field(bxy, 4);
    stream.field(azimuth, 7);
    stream.field(elevation, 7);
  }
  stream.field(record.sample_dt_us);
  stream.field(record.read_duration_us);
  stream.field(static_cast<unsigned long>(record.quality_flags));
  stream.rowEnd();
}
