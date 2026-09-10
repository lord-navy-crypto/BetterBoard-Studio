#include <Arduino.h>
#include <math.h>
#include <float.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <esp_timer.h>
#include <esp_heap_caps.h>
#include <WiFi.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#if !defined(ARDUINO_ARCH_ESP32)
#error "ESP32NumericalResearchSuite requires Arduino-ESP32."
#endif

// BetterBoard ESP32 Numerical Research Suite — research-stage firmware.
//
// Goals:
//  - use ESP32-specific capabilities to study numerical error, not merely port UNO code;
//  - separate precision error, algorithmic error, scheduling jitter, grouping/order effects,
//    transport/radio interference, timer semantics, and optional PSRAM-backed workloads;
//  - keep GPIO untouched until the exact board/pin map is known;
//  - emit machine-readable numeric rows plus # metadata/control lines.
//
// Scientific boundary:
//  - sin()/sinf() are local library comparisons, NOT truth;
//  - timing results characterize this run/firmware/environment, not the entire ESP32 family;
//  - Wi-Fi scan timing is environmentally dependent;
//  - multicore results show grouping/scheduling effects, not a universal parallel-speed claim;
//  - PSRAM tests run only when external PSRAM is actually detected;
//  - no external GPIO/ADC/PWM is touched by this suite.

static const uint32_t BAUD = 115200;
static const uint32_t SCHEMA_VERSION = 1;
static const size_t COMMAND_CAP = 96;

char commandBuffer[COMMAND_CAP];
size_t commandLength = 0;
uint32_t runId = 0;

volatile bool loadTaskRun = false;
volatile uint64_t loadTaskIterations = 0;
TaskHandle_t loadTaskHandle = nullptr;

struct JitterStats {
  uint32_t periodUs;
  uint32_t samples;
  int64_t minErrorUs;
  int64_t maxErrorUs;
  double meanErrorUs;
  double rmsErrorUs;
  uint32_t deadlineMisses;
};

struct WorkerArgs {
  uint32_t begin;
  uint32_t end;
  volatile float resultF;
  volatile double resultD;
  volatile bool done;
};

static inline float generatedValueF(uint32_t i) {
  // Deterministic cancellation-heavy sequence; host can reproduce exactly enough to
  // compare algorithms, while the MCU result still depends on float arithmetic.
  const float sign = (i & 1U) ? -1.0f : 1.0f;
  const float small = (float)((i % 97U) + 1U) * 1.0e-6f;
  return sign * (1.0f + small);
}

static inline double generatedValueD(uint32_t i) {
  const double sign = (i & 1U) ? -1.0 : 1.0;
  const double small = (double)((i % 97U) + 1U) * 1.0e-6;
  return sign * (1.0 + small);
}

void printBoundary() {
  Serial.println(F("#BOUNDARY,no external GPIO/ADC/PWM; host high-precision reference required for truth claims"));
}

void printSchema() {
  Serial.print(F("#SCHEMA,betterboard-esp32-numerical-research-v"));
  Serial.println(SCHEMA_VERSION);
  Serial.println(F("#ROW_TYPES"));
  Serial.println(F("#  SUM,run_id,n,naive_f32,kahan_f32,naive_f64,kahan_f64,elapsed_naive_f32_us,elapsed_kahan_f32_us,elapsed_naive_f64_us,elapsed_kahan_f64_us"));
  Serial.println(F("#  SERIES,run_id,n,forward_f32,reverse_f32,pairwise_f32,forward_f64,reverse_f64,pairwise_f64"));
  Serial.println(F("#  TAYLOR,run_id,x,terms,raw_f32,reduced_f32,raw_f64,reduced_f64,sinf_local,sin_local,raw_f32_us,reduced_f32_us,raw_f64_us,reduced_f64_us"));
  Serial.println(F("#  JITTER,run_id,mode,period_us,samples,min_error_us,max_error_us,mean_error_us,rms_error_us,deadline_misses,load_iterations"));
  Serial.println(F("#  TIMER,run_id,samples,micros_elapsed_us,esp_timer_elapsed_us,micros_read_cost_ns,esp_timer_read_cost_ns"));
  Serial.println(F("#  DUALCORE,run_id,n,cores,sequential_f32,grouped_f32,sequential_f64,grouped_f64,sequential_us,parallel_us"));
  Serial.println(F("#  PSRAM,run_id,n,psram_found,naive_f32,kahan_f32,elapsed_naive_us,elapsed_kahan_us"));
  Serial.println(F("#  WIFIJITTER,run_id,period_us,samples,min_error_us,max_error_us,mean_error_us,rms_error_us,deadline_misses,networks_seen"));
  printBoundary();
}

void printHelp() {
  Serial.println(F("#HELP,ESP32 Numerical Research Suite"));
  Serial.println(F("#  INFO"));
  Serial.println(F("#  PRECISION"));
  Serial.println(F("#  SUM <n>"));
  Serial.println(F("#  SERIES <n>"));
  Serial.println(F("#  TAYLOR <x> <terms>"));
  Serial.println(F("#  JITTER <period_us> <samples>"));
  Serial.println(F("#  LOADJITTER <period_us> <samples>"));
  Serial.println(F("#  WIFIJITTER <period_us> <samples>"));
  Serial.println(F("#  TIMER <samples>"));
  Serial.println(F("#  DUALCORE <n>"));
  Serial.println(F("#  PSRAM <n>"));
  Serial.println(F("#  SCHEMA"));
  Serial.println(F("#  HELP"));
}

void printInfo() {
  Serial.println(F("#INFO_BEGIN"));
  Serial.print(F("#CHIP_MODEL,")); Serial.println(ESP.getChipModel());
  Serial.print(F("#CHIP_REVISION,")); Serial.println(ESP.getChipRevision());
  Serial.print(F("#CHIP_CORES,")); Serial.println(ESP.getChipCores());
  Serial.print(F("#CPU_FREQ_MHZ,")); Serial.println(getCpuFrequencyMhz());
  Serial.print(F("#FLASH_BYTES,")); Serial.println(ESP.getFlashChipSize());
  Serial.print(F("#HEAP_FREE_BYTES,")); Serial.println(ESP.getFreeHeap());
  Serial.print(F("#HEAP_MIN_FREE_BYTES,")); Serial.println(ESP.getMinFreeHeap());
  Serial.print(F("#PSRAM_FOUND,")); Serial.println(psramFound() ? 1 : 0);
  if (psramFound()) {
    Serial.print(F("#PSRAM_TOTAL_BYTES,")); Serial.println(ESP.getPsramSize());
    Serial.print(F("#PSRAM_FREE_BYTES,")); Serial.println(ESP.getFreePsram());
  }
  Serial.print(F("#SIZEOF_FLOAT,")); Serial.println(sizeof(float));
  Serial.print(F("#SIZEOF_DOUBLE,")); Serial.println(sizeof(double));
  Serial.print(F("#FLT_EPSILON,")); Serial.println(FLT_EPSILON, 10);
  Serial.print(F("#DBL_EPSILON,")); Serial.println(DBL_EPSILON, 18);
  Serial.print(F("#FREERTOS_TICK_HZ,")); Serial.println(configTICK_RATE_HZ);
  Serial.println(F("#INFO_END"));
}

void printPrecision() {
  Serial.println(F("#PRECISION_BEGIN"));
  float nextF = nextafterf(1.0f, 2.0f);
  double nextD = nextafter(1.0, 2.0);
  Serial.print(F("#F32_NEXTAFTER_1,")); Serial.println(nextF, 10);
  Serial.print(F("#F32_ULP_AT_1,")); Serial.println(nextF - 1.0f, 10);
  Serial.print(F("#F64_NEXTAFTER_1,")); Serial.println(nextD, 18);
  Serial.print(F("#F64_ULP_AT_1,")); Serial.println(nextD - 1.0, 18);
  Serial.print(F("#F32_1E8_PLUS_1_MINUS_1E8,"));
  volatile float af = 1.0e8f; volatile float bf = (af + 1.0f) - af; Serial.println((float)bf, 3);
  Serial.print(F("#F64_1E8_PLUS_1_MINUS_1E8,"));
  volatile double ad = 1.0e8; volatile double bd = (ad + 1.0) - ad; Serial.println((double)bd, 3);
  Serial.println(F("#PRECISION_END"));
}

bool parseU32(const char* s, uint32_t& out) {
  if (!s || !*s) return false;
  char* end = nullptr;
  unsigned long v = strtoul(s, &end, 10);
  if (!end || *end != '\0') return false;
  out = (uint32_t)v;
  return true;
}

bool parseDouble(const char* s, double& out) {
  if (!s || !*s) return false;
  char* end = nullptr;
  double v = strtod(s, &end);
  if (!end || *end != '\0' || !isfinite(v)) return false;
  out = v;
  return true;
}

float kahanSumF(uint32_t n) {
  float sum = 0.0f, c = 0.0f;
  for (uint32_t i = 0; i < n; ++i) {
    float y = generatedValueF(i) - c;
    float t = sum + y;
    c = (t - sum) - y;
    sum = t;
  }
  return sum;
}

double kahanSumD(uint32_t n) {
  double sum = 0.0, c = 0.0;
  for (uint32_t i = 0; i < n; ++i) {
    double y = generatedValueD(i) - c;
    double t = sum + y;
    c = (t - sum) - y;
    sum = t;
  }
  return sum;
}

void emitSum(uint32_t n) {
  runId++;
  uint64_t t0, t1;
  volatile float nf = 0.0f;
  t0 = esp_timer_get_time();
  for (uint32_t i = 0; i < n; ++i) nf += generatedValueF(i);
  t1 = esp_timer_get_time(); const uint64_t nfUs = t1 - t0;

  t0 = esp_timer_get_time(); volatile float kf = kahanSumF(n);
  t1 = esp_timer_get_time(); const uint64_t kfUs = t1 - t0;

  volatile double nd = 0.0;
  t0 = esp_timer_get_time();
  for (uint32_t i = 0; i < n; ++i) nd += generatedValueD(i);
  t1 = esp_timer_get_time(); const uint64_t ndUs = t1 - t0;

  t0 = esp_timer_get_time(); volatile double kd = kahanSumD(n);
  t1 = esp_timer_get_time(); const uint64_t kdUs = t1 - t0;

  Serial.print(F("SUM,")); Serial.print(runId); Serial.print(',');
  Serial.print(n); Serial.print(',');
  Serial.print((float)nf, 9); Serial.print(',');
  Serial.print((float)kf, 9); Serial.print(',');
  Serial.print((double)nd, 15); Serial.print(',');
  Serial.print((double)kd, 15); Serial.print(',');
  Serial.print(nfUs); Serial.print(','); Serial.print(kfUs); Serial.print(',');
  Serial.print(ndUs); Serial.print(','); Serial.println(kdUs);
}

float pairwiseF(uint32_t begin, uint32_t end) {
  uint32_t len = end - begin;
  if (len == 0) return 0.0f;
  if (len == 1) return generatedValueF(begin);
  uint32_t mid = begin + len / 2;
  return pairwiseF(begin, mid) + pairwiseF(mid, end);
}

double pairwiseD(uint32_t begin, uint32_t end) {
  uint32_t len = end - begin;
  if (len == 0) return 0.0;
  if (len == 1) return generatedValueD(begin);
  uint32_t mid = begin + len / 2;
  return pairwiseD(begin, mid) + pairwiseD(mid, end);
}

void emitSeries(uint32_t n) {
  runId++;
  volatile float ff = 0.0f, rf = 0.0f;
  volatile double fd = 0.0, rd = 0.0;
  for (uint32_t i = 0; i < n; ++i) { ff += generatedValueF(i); fd += generatedValueD(i); }
  for (uint32_t i = n; i > 0; --i) { rf += generatedValueF(i - 1); rd += generatedValueD(i - 1); }
  float pf = pairwiseF(0, n);
  double pd = pairwiseD(0, n);
  Serial.print(F("SERIES,")); Serial.print(runId); Serial.print(','); Serial.print(n); Serial.print(',');
  Serial.print((float)ff, 9); Serial.print(','); Serial.print((float)rf, 9); Serial.print(','); Serial.print(pf, 9); Serial.print(',');
  Serial.print((double)fd, 15); Serial.print(','); Serial.print((double)rd, 15); Serial.print(','); Serial.println(pd, 15);
}

float reduceAngleF(float x) {
  const float twoPi = 2.0f * PI;
  return remainderf(x, twoPi);
}

double reduceAngleD(double x) {
  const double twoPi = 2.0 * (double)PI;
  return remainder(x, twoPi);
}

float taylorSinF(float x, uint32_t terms) {
  float sum = x;
  float term = x;
  for (uint32_t k = 1; k < terms; ++k) {
    float denom = (float)((2U * k) * (2U * k + 1U));
    term *= -(x * x) / denom;
    sum += term;
  }
  return sum;
}

double taylorSinD(double x, uint32_t terms) {
  double sum = x;
  double term = x;
  for (uint32_t k = 1; k < terms; ++k) {
    double denom = (double)((2U * k) * (2U * k + 1U));
    term *= -(x * x) / denom;
    sum += term;
  }
  return sum;
}

void emitTaylor(double x, uint32_t terms) {
  runId++;
  uint64_t t0, t1;
  const float xf = (float)x;
  const float xrf = reduceAngleF(xf);
  const double xrd = reduceAngleD(x);

  t0 = esp_timer_get_time(); volatile float rawF = taylorSinF(xf, terms); t1 = esp_timer_get_time(); uint64_t rawFUs = t1 - t0;
  t0 = esp_timer_get_time(); volatile float redF = taylorSinF(xrf, terms); t1 = esp_timer_get_time(); uint64_t redFUs = t1 - t0;
  t0 = esp_timer_get_time(); volatile double rawD = taylorSinD(x, terms); t1 = esp_timer_get_time(); uint64_t rawDUs = t1 - t0;
  t0 = esp_timer_get_time(); volatile double redD = taylorSinD(xrd, terms); t1 = esp_timer_get_time(); uint64_t redDUs = t1 - t0;

  Serial.print(F("TAYLOR,")); Serial.print(runId); Serial.print(',');
  Serial.print(x, 12); Serial.print(','); Serial.print(terms); Serial.print(',');
  Serial.print((float)rawF, 9); Serial.print(','); Serial.print((float)redF, 9); Serial.print(',');
  Serial.print((double)rawD, 15); Serial.print(','); Serial.print((double)redD, 15); Serial.print(',');
  Serial.print(sinf(xf), 9); Serial.print(','); Serial.print(sin(x), 15); Serial.print(',');
  Serial.print(rawFUs); Serial.print(','); Serial.print(redFUs); Serial.print(',');
  Serial.print(rawDUs); Serial.print(','); Serial.println(redDUs);
}

void loadTask(void*) {
  volatile double x = 0.123456789;
  while (loadTaskRun) {
    // Deliberately compute-heavy and memory-light so this is mainly CPU/scheduler load.
    x = sin(x) + sqrt(fabs(x) + 1.0);
    loadTaskIterations++;
    if ((loadTaskIterations & 0x3FFULL) == 0) taskYIELD();
  }
  loadTaskHandle = nullptr;
  vTaskDelete(nullptr);
}

void startLoadTask() {
  if (loadTaskRun) return;
  loadTaskIterations = 0;
  loadTaskRun = true;
  BaseType_t core = 0;
  if (ESP.getChipCores() > 1) core = 1;
  xTaskCreatePinnedToCore(loadTask, "bb-num-load", 4096, nullptr, 1, &loadTaskHandle, core);
}

void stopLoadTask() {
  loadTaskRun = false;
  uint32_t wait = 0;
  while (loadTaskHandle != nullptr && wait < 1000) { delay(1); wait++; }
}

JitterStats measureJitter(uint32_t periodUs, uint32_t samples) {
  JitterStats s{periodUs, samples, INT64_MAX, INT64_MIN, 0.0, 0.0, 0};
  int64_t target = esp_timer_get_time();
  double sum = 0.0, sumSq = 0.0;
  for (uint32_t i = 0; i < samples; ++i) {
    target += (int64_t)periodUs;
    while (esp_timer_get_time() < target) {
      if (periodUs >= 1000) taskYIELD();
    }
    const int64_t now = esp_timer_get_time();
    const int64_t err = now - target;
    if (err < s.minErrorUs) s.minErrorUs = err;
    if (err > s.maxErrorUs) s.maxErrorUs = err;
    sum += (double)err;
    sumSq += (double)err * (double)err;
    if (err > (int64_t)periodUs) s.deadlineMisses++;
  }
  s.meanErrorUs = sum / (double)samples;
  s.rmsErrorUs = sqrt(sumSq / (double)samples);
  return s;
}

void emitJitter(uint32_t periodUs, uint32_t samples, bool withLoad) {
  runId++;
  if (withLoad) startLoadTask();
  delay(20);
  JitterStats s = measureJitter(periodUs, samples);
  uint64_t iters = loadTaskIterations;
  if (withLoad) stopLoadTask();
  Serial.print(F("JITTER,")); Serial.print(runId); Serial.print(','); Serial.print(withLoad ? 1 : 0); Serial.print(',');
  Serial.print(periodUs); Serial.print(','); Serial.print(samples); Serial.print(',');
  Serial.print(s.minErrorUs); Serial.print(','); Serial.print(s.maxErrorUs); Serial.print(',');
  Serial.print(s.meanErrorUs, 6); Serial.print(','); Serial.print(s.rmsErrorUs, 6); Serial.print(',');
  Serial.print(s.deadlineMisses); Serial.print(','); Serial.println((unsigned long long)iters);
}

void emitTimer(uint32_t samples) {
  runId++;
  uint32_t m0 = micros();
  int64_t e0 = esp_timer_get_time();
  delay(10);
  uint32_t mElapsed = micros() - m0;
  int64_t eElapsed = esp_timer_get_time() - e0;

  uint64_t t0 = (uint64_t)esp_timer_get_time();
  volatile uint32_t sinkM = 0;
  for (uint32_t i = 0; i < samples; ++i) sinkM ^= micros();
  uint64_t t1 = (uint64_t)esp_timer_get_time();
  double microsCostNs = ((double)(t1 - t0) * 1000.0) / (double)samples;

  t0 = (uint64_t)esp_timer_get_time();
  volatile int64_t sinkE = 0;
  for (uint32_t i = 0; i < samples; ++i) sinkE ^= esp_timer_get_time();
  t1 = (uint64_t)esp_timer_get_time();
  double espCostNs = ((double)(t1 - t0) * 1000.0) / (double)samples;

  (void)sinkM; (void)sinkE;
  Serial.print(F("TIMER,")); Serial.print(runId); Serial.print(','); Serial.print(samples); Serial.print(',');
  Serial.print(mElapsed); Serial.print(','); Serial.print((long long)eElapsed); Serial.print(',');
  Serial.print(microsCostNs, 3); Serial.print(','); Serial.println(espCostNs, 3);
}

void sumWorker(void* ptr) {
  WorkerArgs* a = static_cast<WorkerArgs*>(ptr);
  float sf = 0.0f;
  double sd = 0.0;
  for (uint32_t i = a->begin; i < a->end; ++i) {
    sf += generatedValueF(i);
    sd += generatedValueD(i);
  }
  a->resultF = sf;
  a->resultD = sd;
  a->done = true;
  vTaskDelete(nullptr);
}

void emitDualCore(uint32_t n) {
  runId++;
  const uint32_t cores = ESP.getChipCores();
  volatile float seqF = 0.0f;
  volatile double seqD = 0.0;
  uint64_t t0 = esp_timer_get_time();
  for (uint32_t i = 0; i < n; ++i) { seqF += generatedValueF(i); seqD += generatedValueD(i); }
  uint64_t seqUs = esp_timer_get_time() - t0;

  WorkerArgs a{0, n / 2, 0.0f, 0.0, false};
  WorkerArgs b{n / 2, n, 0.0f, 0.0, false};
  t0 = esp_timer_get_time();
  BaseType_t coreA = 0;
  BaseType_t coreB = (cores > 1) ? 1 : 0;
  xTaskCreatePinnedToCore(sumWorker, "bb-sum-a", 4096, &a, 1, nullptr, coreA);
  xTaskCreatePinnedToCore(sumWorker, "bb-sum-b", 4096, &b, 1, nullptr, coreB);
  while (!a.done || !b.done) delay(1);
  float groupedF = a.resultF + b.resultF;
  double groupedD = a.resultD + b.resultD;
  uint64_t parUs = esp_timer_get_time() - t0;

  Serial.print(F("DUALCORE,")); Serial.print(runId); Serial.print(','); Serial.print(n); Serial.print(','); Serial.print(cores); Serial.print(',');
  Serial.print((float)seqF, 9); Serial.print(','); Serial.print(groupedF, 9); Serial.print(',');
  Serial.print((double)seqD, 15); Serial.print(','); Serial.print(groupedD, 15); Serial.print(',');
  Serial.print(seqUs); Serial.print(','); Serial.println(parUs);
}

void emitPsram(uint32_t n) {
  runId++;
  if (!psramFound()) {
    Serial.print(F("PSRAM,")); Serial.print(runId); Serial.print(','); Serial.print(n); Serial.println(F(",0,nan,nan,0,0"));
    return;
  }
  if (n > 2000000U) n = 2000000U;
  float* data = (float*)heap_caps_malloc((size_t)n * sizeof(float), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!data) {
    Serial.print(F("#ERROR,psram_allocation_failed,")); Serial.println(n);
    return;
  }
  for (uint32_t i = 0; i < n; ++i) data[i] = generatedValueF(i);

  uint64_t t0 = esp_timer_get_time();
  volatile float naive = 0.0f;
  for (uint32_t i = 0; i < n; ++i) naive += data[i];
  uint64_t naiveUs = esp_timer_get_time() - t0;

  t0 = esp_timer_get_time();
  float sum = 0.0f, c = 0.0f;
  for (uint32_t i = 0; i < n; ++i) {
    float y = data[i] - c;
    float t = sum + y;
    c = (t - sum) - y;
    sum = t;
  }
  volatile float kahan = sum;
  uint64_t kahanUs = esp_timer_get_time() - t0;
  free(data);

  Serial.print(F("PSRAM,")); Serial.print(runId); Serial.print(','); Serial.print(n); Serial.print(F(",1,"));
  Serial.print((float)naive, 9); Serial.print(','); Serial.print((float)kahan, 9); Serial.print(',');
  Serial.print(naiveUs); Serial.print(','); Serial.println(kahanUs);
}

void emitWifiJitter(uint32_t periodUs, uint32_t samples) {
  runId++;
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true, false);
  delay(20);
  WiFi.scanDelete();
  WiFi.scanNetworks(true, true);
  JitterStats s = measureJitter(periodUs, samples);
  int networks = WiFi.scanComplete();
  uint32_t waitMs = 0;
  while (networks == WIFI_SCAN_RUNNING && waitMs < 5000) {
    delay(10); waitMs += 10; networks = WiFi.scanComplete();
  }
  if (networks < 0) networks = 0;
  WiFi.scanDelete();
  WiFi.mode(WIFI_OFF);

  Serial.print(F("WIFIJITTER,")); Serial.print(runId); Serial.print(','); Serial.print(periodUs); Serial.print(','); Serial.print(samples); Serial.print(',');
  Serial.print(s.minErrorUs); Serial.print(','); Serial.print(s.maxErrorUs); Serial.print(',');
  Serial.print(s.meanErrorUs, 6); Serial.print(','); Serial.print(s.rmsErrorUs, 6); Serial.print(',');
  Serial.print(s.deadlineMisses); Serial.print(','); Serial.println(networks);
}

void handleCommand(char* line) {
  while (*line == ' ') ++line;
  if (*line == '\0') return;
  char* cmd = strtok(line, " ");
  if (!cmd) return;
  for (char* p = cmd; *p; ++p) *p = (char)toupper((unsigned char)*p);

  if (!strcmp(cmd, "HELP")) return printHelp();
  if (!strcmp(cmd, "INFO")) return printInfo();
  if (!strcmp(cmd, "PRECISION")) return printPrecision();
  if (!strcmp(cmd, "SCHEMA")) return printSchema();

  if (!strcmp(cmd, "SUM") || !strcmp(cmd, "SERIES") || !strcmp(cmd, "DUALCORE") || !strcmp(cmd, "PSRAM") || !strcmp(cmd, "TIMER")) {
    uint32_t n = 0;
    if (!parseU32(strtok(nullptr, " "), n)) { Serial.println(F("#ERROR,expected unsigned integer")); return; }
    if (!strcmp(cmd, "SUM")) {
      if (n < 10 || n > 2000000U) { Serial.println(F("#ERROR,SUM n range 10..2000000")); return; }
      return emitSum(n);
    }
    if (!strcmp(cmd, "SERIES")) {
      if (n < 2 || n > 131072U) { Serial.println(F("#ERROR,SERIES n range 2..131072")); return; }
      return emitSeries(n);
    }
    if (!strcmp(cmd, "DUALCORE")) {
      if (n < 1000 || n > 2000000U) { Serial.println(F("#ERROR,DUALCORE n range 1000..2000000")); return; }
      return emitDualCore(n);
    }
    if (!strcmp(cmd, "PSRAM")) {
      if (n < 1000 || n > 2000000U) { Serial.println(F("#ERROR,PSRAM n range 1000..2000000")); return; }
      return emitPsram(n);
    }
    if (!strcmp(cmd, "TIMER")) {
      if (n < 100 || n > 1000000U) { Serial.println(F("#ERROR,TIMER samples range 100..1000000")); return; }
      return emitTimer(n);
    }
  }

  if (!strcmp(cmd, "TAYLOR")) {
    double x = 0.0; uint32_t terms = 0;
    if (!parseDouble(strtok(nullptr, " "), x) || !parseU32(strtok(nullptr, " "), terms) || terms < 1 || terms > 80 || fabs(x) > 1000.0) {
      Serial.println(F("#ERROR,TAYLOR expects x[-1000,1000] terms[1,80]")); return;
    }
    return emitTaylor(x, terms);
  }

  if (!strcmp(cmd, "JITTER") || !strcmp(cmd, "LOADJITTER") || !strcmp(cmd, "WIFIJITTER")) {
    uint32_t periodUs = 0, samples = 0;
    if (!parseU32(strtok(nullptr, " "), periodUs) || !parseU32(strtok(nullptr, " "), samples) || periodUs < 100 || periodUs > 1000000U || samples < 20 || samples > 20000U) {
      Serial.println(F("#ERROR,jitter expects period_us 100..1000000 samples 20..20000")); return;
    }
    if (!strcmp(cmd, "JITTER")) return emitJitter(periodUs, samples, false);
    if (!strcmp(cmd, "LOADJITTER")) return emitJitter(periodUs, samples, true);
    return emitWifiJitter(periodUs, samples);
  }

  Serial.println(F("#ERROR,unknown_command"));
}

void setup() {
  Serial.begin(BAUD);
  delay(600);
  Serial.println(F("#READY,BetterBoard ESP32 Numerical Research Suite"));
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
    } else if (commandLength + 1 < COMMAND_CAP) {
      commandBuffer[commandLength++] = c;
    } else {
      commandLength = 0;
      Serial.println(F("#ERROR,command_too_long"));
    }
  }
  delay(1);
}
