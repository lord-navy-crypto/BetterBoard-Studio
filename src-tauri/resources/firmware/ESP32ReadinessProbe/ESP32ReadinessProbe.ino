#include <Arduino.h>
#include <math.h>
#include <float.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#if !defined(ARDUINO_ARCH_ESP32)
#error "ESP32ReadinessProbe requires an ESP32-family board/core."
#endif

// BetterBoard ESP32 Readiness Probe — research-stage firmware
// Purpose:
//   1. Prove compile/upload/serial on an ESP32-family target.
//   2. Report portable MCU/runtime facts without guessing a board-specific pin map.
//   3. Provide a deterministic timing + numerical smoke test.
//   4. Avoid touching external GPIO by default.
//
// Safety / evidence boundary:
//   - No GPIO is driven by this firmware.
//   - No ADC pin is assumed.
//   - Reported chip/runtime values are board/firmware evidence, not calibration.
//   - This firmware is intentionally conservative until the exact ESP32 board is known.

static const uint32_t BAUD = 115200;
static const uint32_t SCHEMA_VERSION = 1;

uint32_t runId = 0;
char commandBuffer[64];
size_t commandLength = 0;

struct TimingSummary {
  uint32_t requestedUs;
  uint32_t samples;
  int32_t minErrorUs;
  int32_t maxErrorUs;
  double meanErrorUs;
  double rmsErrorUs;
};

void printHelp() {
  Serial.println(F("#HELP,commands"));
  Serial.println(F("#  INFO"));
  Serial.println(F("#  FLOAT"));
  Serial.println(F("#  TIMING <period_us> <samples>"));
  Serial.println(F("#  BENCH <iterations>"));
  Serial.println(F("#  SCHEMA"));
  Serial.println(F("#  HELP"));
}

void printSchema() {
  Serial.print(F("#SCHEMA,betterboard-esp32-readiness-v"));
  Serial.println(SCHEMA_VERSION);
  Serial.println(F("#TIMING_COLUMNS,run_id,requested_us,samples,min_error_us,max_error_us,mean_error_us,rms_error_us"));
  Serial.println(F("#BENCH_COLUMNS,run_id,iterations,float32_sum,float64_sum,float32_elapsed_us,float64_elapsed_us"));
  Serial.println(F("#BOUNDARY,no external GPIO is driven; no board-specific ADC pin is assumed"));
}

void printInfo() {
  Serial.println(F("#INFO_BEGIN"));
  Serial.println(F("#ARCH,ESP32"));
  Serial.print(F("#CPU_FREQ_MHZ,"));
  Serial.println(getCpuFrequencyMhz());
  Serial.print(F("#CHIP_MODEL,"));
  Serial.println(ESP.getChipModel());
  Serial.print(F("#CHIP_REVISION,"));
  Serial.println(ESP.getChipRevision());
  Serial.print(F("#CHIP_CORES,"));
  Serial.println(ESP.getChipCores());
  Serial.print(F("#FLASH_BYTES,"));
  Serial.println(ESP.getFlashChipSize());
  Serial.print(F("#HEAP_FREE_BYTES,"));
  Serial.println(ESP.getFreeHeap());
  Serial.print(F("#HEAP_MIN_FREE_BYTES,"));
  Serial.println(ESP.getMinFreeHeap());
  Serial.print(F("#SKETCH_SIZE_BYTES,"));
  Serial.println(ESP.getSketchSize());
  Serial.print(F("#FREE_SKETCH_SPACE_BYTES,"));
  Serial.println(ESP.getFreeSketchSpace());
  Serial.print(F("#SIZEOF_FLOAT,"));
  Serial.println(sizeof(float));
  Serial.print(F("#SIZEOF_DOUBLE,"));
  Serial.println(sizeof(double));
  Serial.print(F("#FLT_EPSILON,"));
  Serial.println(FLT_EPSILON, 10);
  Serial.print(F("#DBL_EPSILON,"));
  Serial.println(DBL_EPSILON, 18);
  Serial.print(F("#MILLIS,"));
  Serial.println(millis());
  Serial.print(F("#MICROS,"));
  Serial.println(micros());
  Serial.println(F("#INFO_END"));
}

void printFloatSmoke() {
  const float xf = 1.0f / 10.0f;
  const double xd = 1.0 / 10.0;
  const float sf = sinf(1.0f);
  const double sd = sin(1.0);
  Serial.println(F("#FLOAT_BEGIN"));
  Serial.print(F("#FLOAT32_ONE_TENTH,")); Serial.println(xf, 10);
  Serial.print(F("#FLOAT64_ONE_TENTH,")); Serial.println(xd, 18);
  Serial.print(F("#FLOAT32_SIN1,")); Serial.println(sf, 10);
  Serial.print(F("#FLOAT64_SIN1,")); Serial.println(sd, 18);
  Serial.println(F("#FLOAT_END"));
}

TimingSummary runTiming(uint32_t requestedUs, uint32_t samples) {
  TimingSummary out{requestedUs, samples, INT32_MAX, INT32_MIN, 0.0, 0.0};
  uint32_t target = micros();
  double sum = 0.0;
  double sumSq = 0.0;

  for (uint32_t i = 0; i < samples; ++i) {
    target += requestedUs;
    while ((int32_t)(micros() - target) < 0) {
      delayMicroseconds(1);
    }
    const int32_t err = (int32_t)(micros() - target);
    if (err < out.minErrorUs) out.minErrorUs = err;
    if (err > out.maxErrorUs) out.maxErrorUs = err;
    sum += (double)err;
    sumSq += (double)err * (double)err;
  }

  out.meanErrorUs = sum / (double)samples;
  out.rmsErrorUs = sqrt(sumSq / (double)samples);
  return out;
}

void emitTiming(uint32_t periodUs, uint32_t samples) {
  runId++;
  const TimingSummary s = runTiming(periodUs, samples);
  Serial.print(runId); Serial.print(',');
  Serial.print(s.requestedUs); Serial.print(',');
  Serial.print(s.samples); Serial.print(',');
  Serial.print(s.minErrorUs); Serial.print(',');
  Serial.print(s.maxErrorUs); Serial.print(',');
  Serial.print(s.meanErrorUs, 6); Serial.print(',');
  Serial.println(s.rmsErrorUs, 6);
}

void emitBench(uint32_t iterations) {
  runId++;
  volatile float sumF = 0.0f;
  volatile double sumD = 0.0;

  const uint32_t startF = micros();
  for (uint32_t i = 0; i < iterations; ++i) {
    sumF += 0.0001f;
  }
  const uint32_t elapsedF = micros() - startF;

  const uint32_t startD = micros();
  for (uint32_t i = 0; i < iterations; ++i) {
    sumD += 0.0001;
  }
  const uint32_t elapsedD = micros() - startD;

  Serial.print(runId); Serial.print(',');
  Serial.print(iterations); Serial.print(',');
  Serial.print((float)sumF, 9); Serial.print(',');
  Serial.print((double)sumD, 15); Serial.print(',');
  Serial.print(elapsedF); Serial.print(',');
  Serial.println(elapsedD);
}

bool parseUInt(const char* s, uint32_t& out) {
  if (!s || !*s) return false;
  char* end = nullptr;
  const unsigned long value = strtoul(s, &end, 10);
  if (!end || *end != '\0') return false;
  out = (uint32_t)value;
  return true;
}

void handleCommand(char* line) {
  while (*line == ' ') ++line;
  if (*line == '\0') return;

  char* cmd = strtok(line, " ");
  if (!cmd) return;
  for (char* p = cmd; *p; ++p) *p = (char)toupper((unsigned char)*p);

  if (!strcmp(cmd, "HELP")) {
    printHelp();
  } else if (!strcmp(cmd, "INFO")) {
    printInfo();
  } else if (!strcmp(cmd, "FLOAT")) {
    printFloatSmoke();
  } else if (!strcmp(cmd, "SCHEMA")) {
    printSchema();
  } else if (!strcmp(cmd, "TIMING")) {
    char* a = strtok(nullptr, " ");
    char* b = strtok(nullptr, " ");
    uint32_t periodUs = 0, samples = 0;
    if (!parseUInt(a, periodUs) || !parseUInt(b, samples) || periodUs < 50 || periodUs > 1000000 || samples < 10 || samples > 10000) {
      Serial.println(F("#ERROR,TIMING expects period_us 50..1000000 and samples 10..10000"));
      return;
    }
    emitTiming(periodUs, samples);
  } else if (!strcmp(cmd, "BENCH")) {
    char* a = strtok(nullptr, " ");
    uint32_t iterations = 0;
    if (!parseUInt(a, iterations) || iterations < 100 || iterations > 5000000) {
      Serial.println(F("#ERROR,BENCH expects iterations 100..5000000"));
      return;
    }
    emitBench(iterations);
  } else {
    Serial.println(F("#ERROR,unknown_command"));
  }
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println(F("#READY,BetterBoard ESP32 Readiness Probe"));
  printSchema();
  printInfo();
  printHelp();
}

void loop() {
  while (Serial.available() > 0) {
    const char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      commandBuffer[commandLength] = '\0';
      handleCommand(commandBuffer);
      commandLength = 0;
    } else if (commandLength + 1 < sizeof(commandBuffer)) {
      commandBuffer[commandLength++] = c;
    } else {
      commandLength = 0;
      Serial.println(F("#ERROR,command_too_long"));
    }
  }
}
