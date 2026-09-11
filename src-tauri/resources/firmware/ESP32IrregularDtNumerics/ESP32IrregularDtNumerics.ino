#include <Arduino.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <esp_timer.h>
#include <WiFi.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#if !defined(ARDUINO_ARCH_ESP32)
#error "ESP32IrregularDtNumerics requires an ESP32-family board/core."
#endif

// Research-stage BetterBoard firmware.
// Question: when real sample spacing is irregular, how much error is introduced by
// pretending dt is constant for derivative/integration work?
//
// Important boundary:
// - Signal is synthetic: y(t) = sin(2*pi*f*t).
// - esp_timer_get_time() timestamps are measurement evidence, not an external time standard.
// - Wi-Fi and load modes are interference experiments, not universal ESP32 claims.
// - Serial output occurs after acquisition so printing does not directly pace the sampler.
// - load/Wi-Fi modes fail closed if their requested interference source cannot start.

static const uint32_t BAUD = 115200;
static const uint32_t MAX_SAMPLES = 4096;
static const uint32_t MIN_PERIOD_US = 100;
static const uint32_t MAX_PERIOD_US = 1000000;
static const uint32_t SCHEMA_VERSION = 2;
static constexpr double TWO_PI_D = 6.283185307179586476925286766559;

struct Sample {
  int64_t tUs;
  float y;
};

Sample* samplesBuf = nullptr;
float* derivConst = nullptr;
float* derivMeasured = nullptr;
double* integConst = nullptr;
double* integMeasured = nullptr;

volatile bool loadRun = false;
TaskHandle_t loadTaskHandle = nullptr;
uint32_t runId = 0;
char commandBuffer[96];
size_t commandLength = 0;

void loadTask(void*) {
  volatile float x = 0.1234567f;
  while (loadRun) {
    for (int i = 0; i < 2500; ++i) {
      x = sinf(x) + 0.000001f * (float)i;
      if (!isfinite(x)) x = 0.1234567f;
    }
    taskYIELD();
  }
  loadTaskHandle = nullptr;
  vTaskDelete(nullptr);
}

bool ensureBuffers(uint32_t n) {
  if (n > MAX_SAMPLES) return false;
  if (!samplesBuf) samplesBuf = (Sample*)malloc(sizeof(Sample) * MAX_SAMPLES);
  if (!derivConst) derivConst = (float*)malloc(sizeof(float) * MAX_SAMPLES);
  if (!derivMeasured) derivMeasured = (float*)malloc(sizeof(float) * MAX_SAMPLES);
  if (!integConst) integConst = (double*)malloc(sizeof(double) * MAX_SAMPLES);
  if (!integMeasured) integMeasured = (double*)malloc(sizeof(double) * MAX_SAMPLES);
  return samplesBuf && derivConst && derivMeasured && integConst && integMeasured;
}

void printSchema() {
  Serial.print(F("#SCHEMA,betterboard-esp32-irregular-dt-v"));
  Serial.println(SCHEMA_VERSION);
  Serial.println(F("#COLUMNS,run_id,index,mode,period_us,freq_hz,t_us,dt_prev_us,y,d_const,d_measured,i_const,i_measured"));
  Serial.println(F("#UNITS,1,1,enum,us,Hz,us,us,1,1/s,1/s,s,s"));
  Serial.println(F("#BOUNDARY,synthetic sine; host must compute independent analytic reference"));
}

void printHelp() {
  Serial.println(F("#HELP"));
  Serial.println(F("# IRREG <period_us> <samples> <freq_hz> <IDLE|LOAD|WIFI>"));
  Serial.println(F("# INFO"));
  Serial.println(F("# SCHEMA"));
  Serial.println(F("# HELP"));
}

void printInfo() {
  Serial.println(F("#INFO_BEGIN"));
  Serial.print(F("#CHIP_MODEL,")); Serial.println(ESP.getChipModel());
  Serial.print(F("#CHIP_REVISION,")); Serial.println(ESP.getChipRevision());
  Serial.print(F("#CHIP_CORES,")); Serial.println(ESP.getChipCores());
  Serial.print(F("#CPU_FREQ_MHZ,")); Serial.println(getCpuFrequencyMhz());
  Serial.print(F("#FREE_HEAP,")); Serial.println(ESP.getFreeHeap());
  Serial.print(F("#PSRAM_BYTES,")); Serial.println(ESP.getPsramSize());
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

bool parseDoubleValue(const char* s, double& out) {
  if (!s || !*s) return false;
  char* end = nullptr;
  double v = strtod(s, &end);
  if (!end || *end != '\0' || !isfinite(v)) return false;
  out = v;
  return true;
}

bool startLoad() {
  if (loadTaskHandle) return true;
  loadRun = true;
  BaseType_t ok = xTaskCreatePinnedToCore(
    loadTask,
    "bb-num-load",
    4096,
    nullptr,
    1,
    &loadTaskHandle,
    (ESP.getChipCores() > 1) ? 1 : 0
  );
  if (ok != pdPASS) {
    loadRun = false;
    loadTaskHandle = nullptr;
    return false;
  }
  return true;
}

void stopLoad() {
  loadRun = false;
  uint32_t waited = 0;
  while (loadTaskHandle && waited < 2000) {
    delay(1);
    ++waited;
  }
}

bool startWifiInterference() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(false, false);
  delay(20);
  WiFi.scanDelete();
  const int state = WiFi.scanNetworks(true, true);
  if (state == WIFI_SCAN_FAILED) {
    WiFi.mode(WIFI_OFF);
    return false;
  }
  return true;
}

void stopWifiInterference() {
  WiFi.scanDelete();
  WiFi.mode(WIFI_OFF);
}

void waitUntilTarget(int64_t targetUs) {
  while (true) {
    const int64_t now = esp_timer_get_time();
    const int64_t remaining = targetUs - now;
    if (remaining <= 0) return;
    if (remaining > 1500) {
      delayMicroseconds(100);
    } else if (remaining > 200) {
      taskYIELD();
    } else if (remaining > 25) {
      delayMicroseconds(5);
    }
  }
}

void acquire(uint32_t periodUs, uint32_t n, double freqHz) {
  const double omega = TWO_PI_D * freqHz;
  int64_t target = esp_timer_get_time();
  for (uint32_t i = 0; i < n; ++i) {
    target += (int64_t)periodUs;
    waitUntilTarget(target);
    const int64_t t = esp_timer_get_time();
    samplesBuf[i].tUs = t;
    samplesBuf[i].y = (float)sin(omega * ((double)t * 1e-6));
  }
}

void computeNumerics(uint32_t periodUs, uint32_t n) {
  const double nominalDt = (double)periodUs * 1e-6;

  derivConst[0] = NAN;
  derivMeasured[0] = NAN;
  derivConst[n - 1] = NAN;
  derivMeasured[n - 1] = NAN;

  for (uint32_t i = 1; i + 1 < n; ++i) {
    const double dy = (double)samplesBuf[i + 1].y - (double)samplesBuf[i - 1].y;
    derivConst[i] = (float)(dy / (2.0 * nominalDt));
    const double measuredDt = ((double)(samplesBuf[i + 1].tUs - samplesBuf[i - 1].tUs)) * 1e-6;
    derivMeasured[i] = measuredDt > 0.0 ? (float)(dy / measuredDt) : NAN;
  }

  integConst[0] = 0.0;
  integMeasured[0] = 0.0;
  for (uint32_t i = 1; i < n; ++i) {
    const double y0 = (double)samplesBuf[i - 1].y;
    const double y1 = (double)samplesBuf[i].y;
    const double areaScale = 0.5 * (y0 + y1);
    integConst[i] = integConst[i - 1] + areaScale * nominalDt;
    const double measuredDt = ((double)(samplesBuf[i].tUs - samplesBuf[i - 1].tUs)) * 1e-6;
    integMeasured[i] = measuredDt > 0.0
      ? integMeasured[i - 1] + areaScale * measuredDt
      : NAN;
  }
}

void emitRows(uint32_t periodUs, uint32_t n, double freqHz, const char* mode) {
  for (uint32_t i = 0; i < n; ++i) {
    const int64_t dtPrev = i == 0 ? 0 : samplesBuf[i].tUs - samplesBuf[i - 1].tUs;
    Serial.print(runId); Serial.print(',');
    Serial.print(i); Serial.print(',');
    Serial.print(mode); Serial.print(',');
    Serial.print(periodUs); Serial.print(',');
    Serial.print(freqHz, 8); Serial.print(',');
    Serial.print((long long)samplesBuf[i].tUs); Serial.print(',');
    Serial.print((long long)dtPrev); Serial.print(',');
    Serial.print(samplesBuf[i].y, 9); Serial.print(',');
    if (isfinite(derivConst[i])) Serial.print(derivConst[i], 9); else Serial.print(F("nan"));
    Serial.print(',');
    if (isfinite(derivMeasured[i])) Serial.print(derivMeasured[i], 9); else Serial.print(F("nan"));
    Serial.print(',');
    Serial.print(integConst[i], 12); Serial.print(',');
    Serial.println(integMeasured[i], 12);
  }
}

void runIrregular(uint32_t periodUs, uint32_t n, double freqHz, const char* mode) {
  if (!ensureBuffers(n)) {
    Serial.println(F("#ERROR,buffer_allocation_failed"));
    return;
  }

  const bool useLoad = !strcmp(mode, "LOAD");
  const bool useWifi = !strcmp(mode, "WIFI");

  if (useLoad && !startLoad()) {
    Serial.println(F("#ERROR,load_task_create_failed"));
    return;
  }
  if (useWifi && !startWifiInterference()) {
    Serial.println(F("#ERROR,wifi_scan_start_failed"));
    return;
  }
  delay(25);

  runId++;
  Serial.print(F("#RUN_BEGIN,")); Serial.print(runId); Serial.print(','); Serial.println(mode);
  acquire(periodUs, n, freqHz);

  if (useLoad) stopLoad();
  if (useWifi) stopWifiInterference();

  computeNumerics(periodUs, n);
  emitRows(periodUs, n, freqHz, mode);
  Serial.print(F("#RUN_END,")); Serial.println(runId);
}

void handleCommand(char* line) {
  while (*line == ' ') ++line;
  if (!*line) return;

  char* cmd = strtok(line, " ");
  if (!cmd) return;
  for (char* p = cmd; *p; ++p) *p = (char)toupper((unsigned char)*p);

  if (!strcmp(cmd, "HELP")) {
    printHelp();
    return;
  }
  if (!strcmp(cmd, "SCHEMA")) {
    printSchema();
    return;
  }
  if (!strcmp(cmd, "INFO")) {
    printInfo();
    return;
  }
  if (!strcmp(cmd, "IRREG")) {
    char* a = strtok(nullptr, " ");
    char* b = strtok(nullptr, " ");
    char* c = strtok(nullptr, " ");
    char* d = strtok(nullptr, " ");
    uint32_t periodUs = 0, n = 0;
    double freqHz = 0.0;
    if (!parseUInt(a, periodUs) || !parseUInt(b, n) || !parseDoubleValue(c, freqHz) || !d) {
      Serial.println(F("#ERROR,IRREG syntax"));
      return;
    }
    for (char* p = d; *p; ++p) *p = (char)toupper((unsigned char)*p);
    if (periodUs < MIN_PERIOD_US || periodUs > MAX_PERIOD_US || n < 8 || n > MAX_SAMPLES || freqHz <= 0.0 || freqHz > 10000.0) {
      Serial.println(F("#ERROR,IRREG range"));
      return;
    }
    if (strcmp(d, "IDLE") && strcmp(d, "LOAD") && strcmp(d, "WIFI")) {
      Serial.println(F("#ERROR,mode must be IDLE LOAD or WIFI"));
      return;
    }
    runIrregular(periodUs, n, freqHz, d);
    return;
  }

  Serial.println(F("#ERROR,unknown_command"));
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println(F("#READY,BetterBoard ESP32 Irregular-dt Numerics"));
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
