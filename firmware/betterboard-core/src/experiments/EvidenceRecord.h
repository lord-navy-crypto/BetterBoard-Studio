#pragma once

#include <stdint.h>

#include "../measurement/AcquisitionResult.h"
#include "EngineeringLabEvidence.h"

namespace betterboard {
namespace experiments {

struct EvidenceRecord {
  uint32_t sequence_id{0U};
  uint32_t timestamp_us{0U};
  uint32_t sample_dt_us{0U};
  uint32_t read_duration_us{0U};
  measurement::AcquisitionStatus acquisition_status{
      measurement::AcquisitionStatus::NotReady};
  uint16_t quality_flags{evidence::Valid};

  bool usable() const {
    return acquisition_status == measurement::AcquisitionStatus::Ok &&
           !evidence::hasFlag(quality_flags, evidence::SensorError) &&
           !evidence::hasFlag(quality_flags, evidence::SensorNotReady);
  }
};

inline uint16_t qualityFromStatus(measurement::AcquisitionStatus status,
                                  uint16_t flags = evidence::Valid) {
  switch (status) {
    case measurement::AcquisitionStatus::Ok:
      return flags;
    case measurement::AcquisitionStatus::NotReady:
      return evidence::addFlag(flags, evidence::SensorNotReady);
    case measurement::AcquisitionStatus::Saturated:
      return evidence::addFlag(flags, evidence::Saturated);
    case measurement::AcquisitionStatus::Timeout:
    case measurement::AcquisitionStatus::BusError:
    case measurement::AcquisitionStatus::InvalidValue:
      return evidence::addFlag(flags, evidence::SensorError);
  }
  return evidence::addFlag(flags, evidence::SensorError);
}

template <typename T>
EvidenceRecord makeEvidenceRecord(uint32_t sequence_id,
                                  uint32_t sample_dt_us,
                                  const measurement::AcquisitionResult<T>& result,
                                  uint16_t flags = evidence::Valid) {
  EvidenceRecord record;
  record.sequence_id = sequence_id;
  record.timestamp_us = result.timestamp_us;
  record.sample_dt_us = sample_dt_us;
  record.read_duration_us = result.read_duration_us;
  record.acquisition_status = result.status;
  record.quality_flags = qualityFromStatus(result.status, flags);
  return record;
}

}  // namespace experiments
}  // namespace betterboard
