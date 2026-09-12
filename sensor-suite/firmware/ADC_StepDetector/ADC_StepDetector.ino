#include <BetterBoard.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 5000UL
#endif
#ifndef BB_STEP_THRESHOLD_CODE
#define BB_STEP_THRESHOLD_CODE 50
#endif

betterboard::core::PeriodicSampler sampler(BB_SAMPLE_INTERVAL_US);
int previous = 0;
bool have_previous = false;

void setup() {
  Serial.begin(115200);
  previous = analogRead(A0);
  sampler.reset(micros());
}

void loop() {
  const unsigned long now = micros();
  if (!sampler.ready(now)) return;

  const int code = analogRead(A0);
  const int delta = code - previous;
  const bool step = have_previous && abs(delta) >= BB_STEP_THRESHOLD_CODE;

  Serial.print(now); Serial.print(',');
  Serial.print(code); Serial.print(',');
  Serial.print(delta); Serial.print(',');
  Serial.println(step ? 1 : 0);

  previous = code;
  have_previous = true;
}
