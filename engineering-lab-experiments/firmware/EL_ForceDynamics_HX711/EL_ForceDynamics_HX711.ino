#include <HX711.h>
#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 100000UL
#endif
#ifndef BB_OFFSET_COUNTS
#define BB_OFFSET_COUNTS 0L
#endif
#ifndef BB_COUNTS_PER_NEWTON
#define BB_COUNTS_PER_NEWTON 1000.0f
#endif
#ifndef BB_FILTER_ALPHA
#define BB_FILTER_ALPHA 0.2f
#endif

HX711 scale;
const uint8_t HX_DOUT = 4;
const uint8_t HX_SCK = 5;

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
betterboard::signal::ExponentialMovingAverage filter(BB_FILTER_ALPHA);
betterboard::math::FiniteDifference force_rate;
betterboard::experiments::EngineeringLabStream stream(Serial);

void setup() {
  Serial.begin(115200);
  scale.begin(HX_DOUT, HX_SCK);
  sampler.arm(micros());
  stream.begin("el-force-dynamics-hx711",
               betterboard::experiments::target::OSCILLATION_NUMERICAL_INTEGRATION,
               "time_us,raw_counts,force_n,filtered_force_n,dfdt_nps",
               "us,count,N,N,N/s",
               BB_SAMPLE_INTERVAL_US);
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now) || !scale.is_ready()) return;

  const long raw = scale.read();
  const double force_n = (raw - long(BB_OFFSET_COUNTS)) / double(BB_COUNTS_PER_NEWTON);
  const double filtered = filter.push(force_n);
  double dfdt = 0.0;
  if (force_rate.push(now * 1.0e-6, filtered)) dfdt = force_rate.derivative();

  stream.rowBegin(now);
  stream.field(raw); stream.field(force_n, 6); stream.field(filtered, 6); stream.field(dfdt, 6);
  stream.rowEnd();
}
