#include <Arduino.h>
#include <math.h>
#include <float.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#if !defined(ARDUINO_ARCH_ESP32)
#error "ESP32ConcurrencyNumerics requires an ESP32-family board/core."
#endif

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"

// BetterBoard ESP32 Concurrency Numerics — research-stage firmware
// Focus: how scheduling, grouping, and task placement change numerical behavior.
// No external GPIO is driven; all experiments are compute/timing only.
//
// Scientific boundary:
// - grouped and sequential paths use the same mathematical increment for each precision;
// - AFFINITY reports task placement and does not claim universal parallel speedup;
// - on a single-core target both tasks run on core 0, so the experiment becomes grouped/task execution;
// - timing results characterize this board/build/runtime only.

static const uint32_t BAUD = 115200;
static const uint32_t SCHEMA_VERSION = 3;

char commandBuffer[96];
size_t commandLength = 0;
uint32_t runId = 0;

struct PartialResult {
  double sum;
  uint64_t elapsedUs;
  volatile bool done;
};

struct TaskArgs {
  uint32_t begin;
  uint32_t end;
  double increment;
  PartialResult* out;
};

TaskHandle_t loadTaskHandle = nullptr;
volatile bool loadRunning = false;

void printSchema() {
  Serial.print(F("#SCHEMA,betterboard-esp32-concurrency-numerics-v"));
  Serial.println(SCHEMA_VERSION);
  Serial.println(F("#REDUCE_COLUMNS,type,run_id,n,seq_float32,grouped_float32,seq_float64,grouped_float64,seq_us,grouped_us,float32_delta,float64_delta"));
  Serial.println(F("#AFFINITY_COLUMNS,type,run_id,n,chip_cores,task0_core,task1_core,task0_sum,task1_sum,combined_sum,elapsed_us"));
  Serial.println(F("#JITTER_COLUMNS,type,run_id,period_us,samples,mode,min_late_us,max_late_us,mean_late_us,rms_late_us,deadline_misses"));
  Serial.println(F("#BOUNDARY,results characterize this firmware build and runtime; task placement is not a universal ESP32 guarantee"));
}

void printHelp() {
  Serial.println(F("#HELP,commands"));
  Serial.println(F("#  INFO"));
  Serial.println(F("#  REDUCE <n>"));
  Serial.println(F("#  AFFINITY <n>"));
  Serial.println(F("#  JITTER <period_us> <samples>"));
  Serial.println(F("#  LOADJITTER <period_us> <samples>"));
  Serial.println(F("#  SCHEMA"));
  Serial.println(F("#  HELP"));
}

void printInfo() {
  Serial.println(F("#INFO_BEGIN"));
  Serial.print(F("#CHIP_MODEL,")); Serial.println(ESP.getChipModel());
  Serial.print(F("#CHIP_CORES,")); Serial.println(ESP.getChipCores());
  Serial.print(F("#CPU_FREQ_MHZ,")); Serial.println(getCpuFrequencyMhz());
  Serial.print(F("#SIZEOF_FLOAT,")); Serial.println(sizeof(float));
  Serial.print(F("#SIZEOF_DOUBLE,")); Serial.println(sizeof(double));
  Serial.print(F("#FREE_HEAP_BYTES,")); Serial.println(ESP.getFreeHeap());
  Serial.println(F("#INFO_END"));
}

bool parseUInt(const char* s, uint32_t& out) {
  if (!s || !*s) return false;
  char* end = nullptr;
  unsigned long v = strtoul(s, &end, 10);
  if (!end || *end != '\0') return false;
  out = (uint32_t)v;
  return true;
}

float sequentialFloat(uint32_t n, float inc) {
  volatile float s = 0.0f;
  for (uint32_t i = 0; i < n; ++i) s += inc;
  return s;
}

double sequentialDouble(uint32_t n, double inc) {
  volatile double s = 0.0;
  for (uint32_t i = 0; i < n; ++i) s += inc;
  return s;
}

float groupedFloat(uint32_t n, float inc) {
  uint32_t half = n / 2;
  volatile float a = 0.0f;
  volatile float b = 0.0f;
  for (uint32_t i = 0; i < half; ++i) a += inc;
  for (uint32_t i = half; i < n; ++i) b += inc;
  return a + b;
}

double groupedDouble(uint32_t n, double inc) {
  uint32_t half = n / 2;
  volatile double a = 0.0;
  volatile double b = 0.0;
  for (uint32_t i = 0; i < half; ++i) a += inc;
  for (uint32_t i = half; i < n; ++i) b += inc;
  return a + b;
}

void emitReduce(uint32_t n) {
  runId++;
  const float incF = 0.0001f;
  const double incD = 0.0001;

  uint64_t t0 = esp_timer_get_time();
  float sf = sequentialFloat(n, incF);
  double sd = sequentialDouble(n, incD);
  uint64_t seqUs = (uint64_t)esp_timer_get_time() - t0;

  t0 = esp_timer_get_time();
  float gf = groupedFloat(n, incF);
  double gd = groupedDouble(n, incD);
  uint64_t groupedUs = (uint64_t)esp_timer_get_time() - t0;

  Serial.print(F("REDUCE,"));
  Serial.print(runId); Serial.print(',');
  Serial.print(n); Serial.print(',');
  Serial.print(sf, 9); Serial.print(',');
  Serial.print(gf, 9); Serial.print(',');
  Serial.print(sd, 15); Serial.print(',');
  Serial.print(gd, 15); Serial.print(',');
  Serial.print((unsigned long long)seqUs); Serial.print(',');
  Serial.print((unsigned long long)groupedUs); Serial.print(',');
  Serial.print((double)gf - (double)sf, 12); Serial.print(',');
  Serial.println(gd - sd, 18);
}

void partialTask(void* raw) {
  TaskArgs* args = static_cast<TaskArgs*>(raw);
  uint64_t t0 = esp_timer_get_time();
  volatile double s = 0.0;
  for (uint32_t i = args->begin; i < args->end; ++i) s += args->increment;
  args->out->sum = (double)s;
  args->out->elapsedUs = (uint64_t)esp_timer_get_time() - t0;
  args->out->done = true;
  vTaskDelete(nullptr);
}

void emitAffinity(uint32_t n) {
  runId++;
  PartialResult r0{0.0, 0, false};
  PartialResult r1{0.0, 0, false};
  TaskArgs a0{0, n / 2, 0.0001, &r0};
  TaskArgs a1{n / 2, n, 0.0001, &r1};

  const int cores = ESP.getChipCores();
  const BaseType_t core0 = 0;
  const BaseType_t core1 = cores > 1 ? 1 : 0;

  uint64_t t0 = esp_timer_get_time();
  BaseType_t ok0 = xTaskCreatePinnedToCore(partialTask, "num0", 4096, &a0, 1, nullptr, core0);
  if (ok0 != pdPASS) {
    Serial.println(F("#ERROR,task0_create_failed"));
    return;
  }

  BaseType_t ok1 = xTaskCreatePinnedToCore(partialTask, "num1", 4096, &a1, 1, nullptr, core1);
  if (ok1 != pdPASS) {
    uint32_t waited = 0;
    while (!r0.done && waited < 5000) { delay(1); ++waited; }
    Serial.println(F("#ERROR,task1_create_failed"));
    return;
  }

  uint32_t waited = 0;
  while ((!r0.done || !r1.done) && waited < 30000) {
    delay(1);
    ++waited;
  }
  if (!r0.done || !r1.done) {
    Serial.println(F("#ERROR,affinity_timeout"));
    return;
  }
  uint64_t elapsedUs = (uint64_t)esp_timer_get_time() - t0;

  Serial.print(F("AFFINITY,"));
  Serial.print(runId); Serial.print(',');
  Serial.print(n); Serial.print(',');
  Serial.print(cores); Serial.print(',');
  Serial.print(core0); Serial.print(',');
  Serial.print(core1); Serial.print(',');
  Serial.print(r0.sum, 15); Serial.print(',');
  Serial.print(r1.sum, 15); Serial.print(',');
  Serial.print(r0.sum + r1.sum, 15); Serial.print(',');
  Serial.println((unsigned long long)elapsedUs);
}

void loadTask(void*) {
  volatile double x = 0.123456789;
  while (loadRunning) {
    for (int i = 0; i < 3000; ++i) {
      x = sin(x) + 0.000001 * x;
    }
    taskYIELD();
  }
  loadTaskHandle = nullptr;
  vTaskDelete(nullptr);
}

bool startLoadTask() {
  if (loadTaskHandle != nullptr || loadRunning) return true;
  loadRunning = true;
  BaseType_t ok = xTaskCreate(loadTask, "numload", 4096, nullptr, 1, &loadTaskHandle);
  if (ok != pdPASS) {
    loadRunning = false;
    loadTaskHandle = nullptr;
    return false;
  }
  return true;
}

void stopLoadTask() {
  loadRunning = false;
  uint32_t waited = 0;
  while (loadTaskHandle != nullptr && waited < 2000) {
    delay(1);
    ++waited;
  }
}

void emitJitter(uint32_t periodUs, uint32_t samples, bool withLoad) {
  runId++;
  if (withLoad && !startLoadTask()) {
    Serial.println(F("#ERROR,load_task_create_failed"));
    return;
  }

  int64_t minLate = INT64_MAX;
  int64_t maxLate = INT64_MIN;
  double sum = 0.0;
  double sumSq = 0.0;
  uint32_t misses = 0;
  int64_t target = esp_timer_get_time();

  for (uint32_t i = 0; i < samples; ++i) {
    target += (int64_t)periodUs;
    while (esp_timer_get_time() < target) {
      delayMicroseconds(1);
    }
    int64_t late = esp_timer_get_time() - target;
    if (late < minLate) minLate = late;
    if (late > maxLate) maxLate = late;
    if (late >= (int64_t)periodUs) misses++;
    sum += (double)late;
    sumSq += (double)late * (double)late;
  }

  if (withLoad) stopLoadTask();

  const double mean = sum / (double)samples;
  const double rms = sqrt(sumSq / (double)samples);
  Serial.print(F("JITTER,"));
  Serial.print(runId); Serial.print(',');
  Serial.print(periodUs); Serial.print(',');
  Serial.print(samples); Serial.print(',');
  Serial.print(withLoad ? 1 : 0); Serial.print(',');
  Serial.print((long long)minLate); Serial.print(',');
  Serial.print((long long)maxLate); Serial.print(',');
  Serial.print(mean, 6); Serial.print(',');
  Serial.print(rms, 6); Serial.print(',');
  Serial.println(misses);
}

void handleCommand(char* line) {
  while (*line == ' ') ++line;
  if (!*line) return;
  char* cmd = strtok(line, " ");
  if (!cmd) return;
  for (char* p = cmd; *p; ++p) *p = (char)toupper((unsigned char)*p);

  if (!strcmp(cmd, "INFO")) printInfo();
  else if (!strcmp(cmd, "SCHEMA")) printSchema();
  else if (!strcmp(cmd, "HELP")) printHelp();
  else if (!strcmp(cmd, "REDUCE") || !strcmp(cmd, "AFFINITY")) {
    uint32_t n = 0;
    char* a = strtok(nullptr, " ");
    if (!parseUInt(a, n) || n < 100 || n > 5000000) {
      Serial.println(F("#ERROR,n must be 100..5000000"));
      return;
    }
    if (!strcmp(cmd, "REDUCE")) emitReduce(n); else emitAffinity(n);
  } else if (!strcmp(cmd, "JITTER") || !strcmp(cmd, "LOADJITTER")) {
    uint32_t period = 0, samples = 0;
    char* a = strtok(nullptr, " ");
    char* b = strtok(nullptr, " ");
    if (!parseUInt(a, period) || !parseUInt(b, samples) || period < 50 || period > 1000000 || samples < 10 || samples > 10000) {
      Serial.println(F("#ERROR,period 50..1000000 us; samples 10..10000"));
      return;
    }
    emitJitter(period, samples, !strcmp(cmd, "LOADJITTER"));
  } else {
    Serial.println(F("#ERROR,unknown_command"));
  }
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println(F("#READY,BetterBoard ESP32 Concurrency Numerics"));
  printSchema();
  printInfo();
  printHelp();
}

void loop() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
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
  delay(1);
}
