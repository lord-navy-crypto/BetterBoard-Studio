#include <assert.h>

#include "../src/core/Clock.h"
#include "../src/hal/SensorAdapter.h"

struct AdapterStub {
  betterboard::core::ManualClock* clock;
  float value;
  betterboard::measurement::AcquisitionStatus status;
  uint32_t duration_us;
};

static betterboard::measurement::AcquisitionStatus readStub(void* context, float& value) {
  AdapterStub* stub = static_cast<AdapterStub*>(context);
  value = stub->value;
  stub->clock->advanceMicros(stub->duration_us);
  return stub->status;
}

int main() {
  using betterboard::core::ManualClock;
  using betterboard::hal::ClockedSensorAdapter;
  using betterboard::hal::ISensorAdapter;
  using betterboard::measurement::AcquisitionStatus;

  ManualClock clock(100U);
  AdapterStub stub{&clock, 4.5f, AcquisitionStatus::Ok, 37U};
  ClockedSensorAdapter<float> adapter(clock, &stub, readStub);
  ISensorAdapter<float>& source = adapter;

  const auto good = source.readAt(7000U);
  assert(good.ok());
  assert(good.value == 4.5f);
  assert(good.timestamp_us == 7000U);
  assert(good.read_duration_us == 37U);

  stub.status = AcquisitionStatus::BusError;
  stub.duration_us = 19U;
  const auto failed = source.readAt(7100U);
  assert(!failed.ok());
  assert(failed.status == AcquisitionStatus::BusError);
  assert(failed.timestamp_us == 7100U);
  assert(failed.read_duration_us == 19U);

  return 0;
}
