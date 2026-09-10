#include <Arduino.h>
#include <math.h>
#include <float.h>

#if !defined(ARDUINO_ARCH_ESP32)
#error "ESP32ConcurrencyNumerics requires an ESP32-family board/core."
#endif

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"

// BetterBoard ESP32 Concurrency Numerics — research-stage firmware
// Focus: how scheduling, grouping, and task placement change numerical behavior.
// No external GPIO is driven; all experiments are compute/timing only.

static const uint32_t BAUD = 115200;
static const uint32_t SCHEMA_VERSION = 1;

char commandBuffer[96];
size_t commandLength = 0;
uint32_t runId = 0;

struct PartialResult {
  double sum;
  uint32_t elapsedUs;
  volatile bool done;
};

struct TaskArgs {
  uint32_t begin;
  uint32_t end;
  float increment;
  PartialResult* out;
};

void printSchema() {
  Serial.print(F("#SCHEMA,betterboard-esp32-concurrency-numerics-v"));
  Serial.println(SCHEMA_VERSION);
  Serial.println(F("#REDUCE_COLUMNS,run_id,n,seq_float32,grouped_float32,seq_float64,grouped_float64,seq_us,grouped_us,float32_delta,float64_delta"));
  Serial.println(F("#AFFINITY_COLUMNS,run_id,n,chip_cores,task0_core,task1_core,task0_sum,task1_sum,combined_sum,elapsed_us"));
  Serial.println(F("#JITTER_COLUMNS,run_id,period_us,samples,mode,min_late_us,max_late_us,mean_late_us,rms_late_us,deadline_misses"));
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
  uint32_t seqUs = (uint32_t)(esp_timer_get_time() - t0);

  t0 = esp_timer_get_time();
  float gf = groupedFloat(n, incF);
  double gd = groupedDouble(n, incD);
  uint32_t groupedUs = (uint32_t)(esp_timer_get_time() - t0);

  Serial.print(runId); Serial.print(',');
  Serial.print(n); Serial.print(',');
  Serial.print(sf, 9); Serial.print(',');
  Serial.print(gf, 9); Serial.print(',');
  Serial.print(sd, 15); Serial.print(',');
  Serial.print(gd, 15); Serial.print(',');
  Serial.print(seqUs); Serial.print(',');
  Serial.print(groupedUs); Serial.print(',');
  Serial.print((double)gf - (double)sf, 12); Serial.print(',');
  Serial.println(gd - sd, 18);
}

void partialTask(void* raw) {
  TaskArgs* args = static_cast<TaskArgs*>(raw);
  uint64_t t0 = esp_timer_get_time();
  volatile double s = 0.0;
  for (uint32_t i = args->begin; i < args->end; ++i) s += (double)args->increment;
  args->out->sum = (double)s;
  args->out->elapsedUs = (uint32_t)(esp_timer_get_time() - t0);
  args->out->done = true;
  vTaskDelete(nullptr);
}

void emitAffinity(uint32_t n) {
  runId++;
  PartialResult r0{0.0, 0, false};
  PartialResult r1{0.0, 0, false};
  TaskArgs a0{0, n / 2, 0.0001f, &r0};
  TaskArgs a1{n / 2, n, 0.0001f, &r1};

  const int cores = ESP.getChipCores();
  const BaseType_t core0 = 0;
  const BaseType_t core1 = cores > 1 ? 1 : 0;

  uint64_t t0 = esp_timer_get_time();
  BaseType_t ok0 = xTaskCreatePinnedToCore(partialTask, "num0", 4096, &a0, 1, nullptr, core0);
  BaseType_t ok1 = xTaskCreatePinnedToCore(partialTask, "num1", 4096, &a1, 1, nullptr, core1);
  if (ok0 != pdPASS || ok1 != pdPASS) {
    Serial.println(F("#ERROR,task_create_failed"));
    return;
  }
  while (!r0.done || !r1.done) delay(1);
  uint32_t elapsedUs = (uint32_t)(esp_timer_get_time() - t0);

  Serial.print(runId); Serial.print(',');
  Serial.print(n); Serial.print(',');
  Serial.print(cores); Serial.print(',');
  Serial.print(core0); Serial.print(',');
  Serial.print(core1); Serial.print(',');
  Serial.print(r0.sum, 15); Serial.print(',');
  Serial.print(r1.sum, 15); Serial.print(',');
  Serial.print(r0.sum + r1.sum, 15); Serial.print(',');
  Serial.println(elapsedUs);
}

volatile bool loadRunning = false;
void loadTask(void*) {
  volatile double x = 0.123456789;
  while (loadRunning) {
    for (int i = 0; i < 3000; ++i) {
      x = sin(x) + 0.000001 * x;
    }
    taskYIELD();
  }
  vTaskDelete(nullptr);
}

void emitJitter(uint32_t periodUs, uint32_t samples, bool withLoad) {
  runId++;
  TaskHandle_t loadHandle = nullptr;
  if (withLoad) {
    loadRunning = true;
    xTaskCreate(loadTask, "numload", 4096, nullptr, 1, &loadHandle);
  }

  int64_t minLate = INT64_MAX;
  int64_t maxLate = INT64_MIN;
  long double sum = 0.0L;
  long double sumSq = 0.0L;
  uint32_t misses = 0;
  int64_t target = esp_timer_get_time();

  for (uint32_t i = 0; i < samples; ++i) {
    target += periodUs;
    while (esp_timer_get_time() < target) {
      delayMicroseconds(1);
    }
    int64_t late = esp_timer_get_time() - target;
    if (late < minLate) minLate = late;
    if (late > maxLate) maxLate = late;
    if (late >= (int64_t)periodUs) misses++;
    sum += (long double)late;
    sumSq += (long double)late * (long double)late;
  }

  if (withLoad) {
    loadRunning = false;
    delay(5);
  }

  long double mean = sum / (long double)samples;
  long double rms = sqrt((double)(sumSq / (long double)samples));
  Serial.print(runId); Serial.print(',');
  Serial.print(periodUs); Serial.print(',');
  Serial.print(samples); Serial.print(',');
  Serial.print(withLoad ? 1 : 0); Serial.print(',');
  Serial.print((long long)minLate); Serial.print(',');
  Serial.print((long long)maxLate); Serial.print(',');
  Serial.print((double)mean, 6); Serial.print(',');
  Serial.print((double)rms, 6); Serial.print(',');
  Serial.println(misses);
}

void handleCommand(char* line) {
  while (*line == ' ') ++line;
  if (!*line) return;
  char* cmd = strtok(line, " ");
  for (char* p = cmd; p && *p; ++p) *p = (char)toupper((unsigned char)*p);

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
}
