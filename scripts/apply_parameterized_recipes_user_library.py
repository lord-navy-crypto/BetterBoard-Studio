#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text()


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def replace_once(rel: str, old: str, new: str) -> None:
    text = read(rel)
    count = text.count(old)
    assert count == 1, f"{rel}: expected exactly one match, found {count}: {old[:100]!r}"
    write(rel, text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# 1. Parameterize canonical firmware with compile-time BetterBoard macros.
# ---------------------------------------------------------------------------
write("src-tauri/resources/firmware/Blink_LED/Blink_LED.ino", r'''// BetterBoard / Physical Lab — Arduino UNO programming-path test
// Parameters are compile-time overridable by BetterBoard Recipe Settings.
#ifndef BB_BLINK_ON_MS
#define BB_BLINK_ON_MS 500
#endif
#ifndef BB_BLINK_OFF_MS
#define BB_BLINK_OFF_MS 500
#endif

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay((unsigned long)BB_BLINK_ON_MS);
  digitalWrite(LED_BUILTIN, LOW);
  delay((unsigned long)BB_BLINK_OFF_MS);
}
''')

write("src-tauri/resources/firmware/SyntheticSignal/SyntheticSignal.ino", r'''#include <math.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000
#endif
#ifndef BB_TEST_FREQUENCY_HZ
#define BB_TEST_FREQUENCY_HZ 0.5
#endif

const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
const float TEST_FREQUENCY_HZ = (float)BB_TEST_FREQUENCY_HZ;
unsigned long last_sample_us = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  const float t = now / 1000000.0f;
  const float value = sin(2.0f * PI * TEST_FREQUENCY_HZ * t);
  Serial.print(now);
  Serial.print(',');
  Serial.println(value, 6);
}
''')

write("src-tauri/resources/firmware/AnalogDAQ/AnalogDAQ.ino", r'''// BetterBoard Bench 01 — Analog Control & Instrumentation
// Parameter overrides are injected by BetterBoard before compilation.
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000
#endif
#ifndef BB_NOMINAL_ADC_REFERENCE_V
#define BB_NOMINAL_ADC_REFERENCE_V 5.0
#endif
#ifndef BB_ADC_MIN_COUNTS
#define BB_ADC_MIN_COUNTS 0
#endif
#ifndef BB_ADC_MAX_COUNTS
#define BB_ADC_MAX_COUNTS 1023
#endif
#ifndef BB_FILTER_ALPHA
#define BB_FILTER_ALPHA 0.20
#endif

const uint8_t ANALOG_PIN = A0;
const uint8_t PWM_PIN = 9;
const uint8_t STATUS_LED_PIN = LED_BUILTIN;
const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
const float NOMINAL_ADC_REFERENCE_V = (float)BB_NOMINAL_ADC_REFERENCE_V;
const int ADC_MIN_COUNTS = (int)BB_ADC_MIN_COUNTS;
const int ADC_MAX_COUNTS = (int)BB_ADC_MAX_COUNTS;
const float FILTER_ALPHA = (float)BB_FILTER_ALPHA;

unsigned long last_sample_us = 0;
float filtered_voltage_v = 0.0f;
bool filter_initialized = false;

float clamp01(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 1.0f) return 1.0f;
  return value;
}

void setup() {
  pinMode(PWM_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.begin(115200);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;

  const int raw_adc = analogRead(ANALOG_PIN);
  const int span = ADC_MAX_COUNTS - ADC_MIN_COUNTS;
  const float normalized = span > 0
    ? clamp01((float)(raw_adc - ADC_MIN_COUNTS) / (float)span)
    : 0.0f;
  const float nominal_voltage_v = ((float)raw_adc / 1023.0f) * NOMINAL_ADC_REFERENCE_V;

  if (!filter_initialized) {
    filtered_voltage_v = nominal_voltage_v;
    filter_initialized = true;
  } else {
    filtered_voltage_v += FILTER_ALPHA * (nominal_voltage_v - filtered_voltage_v);
  }

  const int pwm_command = (int)(normalized * 255.0f + 0.5f);
  analogWrite(PWM_PIN, pwm_command);
  digitalWrite(STATUS_LED_PIN, normalized >= 0.5f ? HIGH : LOW);

  Serial.print(now);
  Serial.print(',');
  Serial.print(raw_adc);
  Serial.print(',');
  Serial.print(normalized, 6);
  Serial.print(',');
  Serial.print(nominal_voltage_v, 6);
  Serial.print(',');
  Serial.print(pwm_command);
  Serial.print(',');
  Serial.println(filtered_voltage_v, 6);
}
''')

write("src-tauri/resources/firmware/PhotogateTimer/PhotogateTimer.ino", r'''#ifndef BB_MIN_EDGE_SPACING_US
#define BB_MIN_EDGE_SPACING_US 2000
#endif
const uint8_t GATE_PIN = 2;
const unsigned long MIN_EDGE_SPACING_US = (unsigned long)BB_MIN_EDGE_SPACING_US;
volatile unsigned long previous_edge_us = 0;
volatile unsigned long latest_edge_us = 0;
volatile unsigned long latest_period_us = 0;
volatile bool event_ready = false;

void onGateEdge() {
  const unsigned long now = micros();
  if (previous_edge_us != 0 && (unsigned long)(now - previous_edge_us) < MIN_EDGE_SPACING_US) return;
  latest_edge_us = now;
  if (previous_edge_us != 0) {
    latest_period_us = (unsigned long)(now - previous_edge_us);
    event_ready = true;
  }
  previous_edge_us = now;
}

void setup() {
  Serial.begin(115200);
  pinMode(GATE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(GATE_PIN), onGateEdge, FALLING);
}

void loop() {
  noInterrupts();
  const bool ready = event_ready;
  const unsigned long event_us = latest_edge_us;
  const unsigned long period_us = latest_period_us;
  if (ready) event_ready = false;
  interrupts();
  if (!ready || period_us == 0) return;
  const float frequency_hz = 1000000.0f / float(period_us);
  Serial.print(event_us);
  Serial.print(',');
  Serial.print(period_us);
  Serial.print(',');
  Serial.println(frequency_hz, 6);
}
''')

write("src-tauri/resources/firmware/QuadratureEncoder/QuadratureEncoder.ino", r'''#ifndef BB_COUNTS_PER_REVOLUTION
#define BB_COUNTS_PER_REVOLUTION 600
#endif
#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 10000
#endif
const uint8_t ENC_A = 2;
const uint8_t ENC_B = 3;
const long COUNTS_PER_REVOLUTION = (long)BB_COUNTS_PER_REVOLUTION;
const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
volatile long encoder_count = 0;
unsigned long last_sample_us = 0;

void onA() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a == b) ? 1 : -1;
}
void onB() {
  const bool a = digitalRead(ENC_A);
  const bool b = digitalRead(ENC_B);
  encoder_count += (a != b) ? 1 : -1;
}
void setup() {
  Serial.begin(115200);
  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC_A), onA, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC_B), onB, CHANGE);
}
void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  last_sample_us = now;
  noInterrupts();
  const long count = encoder_count;
  interrupts();
  const float angle_deg = COUNTS_PER_REVOLUTION > 0 ? 360.0f * float(count) / float(COUNTS_PER_REVOLUTION) : 0.0f;
  Serial.print(now);
  Serial.print(',');
  Serial.print(count);
  Serial.print(',');
  Serial.println(angle_deg, 5);
}
''')

write("src-tauri/resources/firmware/PulseRPM/PulseRPM.ino", r'''#ifndef BB_PULSES_PER_REVOLUTION
#define BB_PULSES_PER_REVOLUTION 1.0
#endif
#ifndef BB_MIN_PULSE_SPACING_US
#define BB_MIN_PULSE_SPACING_US 1000
#endif
const uint8_t PULSE_PIN = 2;
const float PULSES_PER_REVOLUTION = (float)BB_PULSES_PER_REVOLUTION;
const unsigned long MIN_PULSE_SPACING_US = (unsigned long)BB_MIN_PULSE_SPACING_US;
volatile unsigned long previous_pulse_us = 0;
volatile unsigned long latest_period_us = 0;
volatile bool period_ready = false;

void onPulse() {
  const unsigned long now = micros();
  if (previous_pulse_us != 0) {
    const unsigned long dt = (unsigned long)(now - previous_pulse_us);
    if (dt >= MIN_PULSE_SPACING_US) {
      latest_period_us = dt;
      period_ready = true;
    }
  }
  previous_pulse_us = now;
}
void setup() {
  Serial.begin(115200);
  pinMode(PULSE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PULSE_PIN), onPulse, FALLING);
}
void loop() {
  noInterrupts();
  const bool ready = period_ready;
  const unsigned long period_us = latest_period_us;
  if (ready) period_ready = false;
  interrupts();
  if (!ready || period_us == 0 || PULSES_PER_REVOLUTION <= 0.0f) return;
  const float rpm = 60000000.0f / (float(period_us) * PULSES_PER_REVOLUTION);
  Serial.print(micros());
  Serial.print(',');
  Serial.print(period_us);
  Serial.print(',');
  Serial.println(rpm, 5);
}
''')

# ---------------------------------------------------------------------------
# 2. New canonical numerical-error programs.
# ---------------------------------------------------------------------------
write("src-tauri/resources/firmware/NumericalDerivativeSweep/NumericalDerivativeSweep.ino", r'''#include <math.h>
#ifndef BB_X_VALUE
#define BB_X_VALUE 1.0
#endif

float forwardDiff(float x, float h) { return (sinf(x + h) - sinf(x)) / h; }
float centralDiff(float x, float h) { return (sinf(x + h) - sinf(x - h)) / (2.0f * h); }

void setup() {
  Serial.begin(115200);
  delay(2000);
  const float x = (float)BB_X_VALUE;
  const float ref = cosf(x);
  const float hs[] = {1e-1f,5e-2f,2e-2f,1e-2f,5e-3f,2e-3f,1e-3f,5e-4f,2e-4f,1e-4f,5e-5f,2e-5f,1e-5f,5e-6f,2e-6f,1e-6f,5e-7f,2e-7f,1e-7f};
  const size_t n = sizeof(hs) / sizeof(hs[0]);
  for (size_t i = 0; i < n; ++i) {
    const float h = hs[i];
    const float fwd = forwardDiff(x, h);
    const float ctr = centralDiff(x, h);
    Serial.print(h, 10); Serial.print(',');
    Serial.print(fwd, 10); Serial.print(',');
    Serial.print(ctr, 10); Serial.print(',');
    Serial.print(ref, 10); Serial.print(',');
    Serial.print(fabsf(fwd - ref), 10); Serial.print(',');
    Serial.println(fabsf(ctr - ref), 10);
  }
}
void loop() {}
''')

write("src-tauri/resources/firmware/NumericalCancellation/NumericalCancellation.ino", r'''#include <math.h>
void setup() {
  Serial.begin(115200);
  delay(2000);
  const float xs[] = {1e-1f,5e-2f,1e-2f,5e-3f,1e-3f,5e-4f,1e-4f,5e-5f,1e-5f,5e-6f,1e-6f,5e-7f,2e-7f,1e-7f,5e-8f};
  const size_t n = sizeof(xs) / sizeof(xs[0]);
  for (size_t i = 0; i < n; ++i) {
    const float x = xs[i];
    const float root = sqrtf(1.0f + x);
    const float raw = root - 1.0f;
    const float stable = x / (root + 1.0f);
    const float diff = fabsf(raw - stable);
    const float rel = stable != 0.0f ? diff / fabsf(stable) : 0.0f;
    Serial.print(x, 10); Serial.print(',');
    Serial.print(raw, 10); Serial.print(',');
    Serial.print(stable, 10); Serial.print(',');
    Serial.print(diff, 10); Serial.print(',');
    Serial.print(rel, 10); Serial.print(',');
    Serial.println(raw == 0.0f ? 1 : 0);
  }
}
void loop() {}
''')

write("src-tauri/resources/firmware/NumericalAccumulation/NumericalAccumulation.ino", r'''#ifndef BB_SUM_COUNT
#define BB_SUM_COUNT 20000
#endif
#ifndef BB_INCREMENT
#define BB_INCREMENT 0.001
#endif

float naiveSum(unsigned long n, float increment) {
  float sum = 0.0f;
  for (unsigned long i = 0; i < n; ++i) sum += increment;
  return sum;
}
float kahanSum(unsigned long n, float increment) {
  float sum = 0.0f;
  float c = 0.0f;
  for (unsigned long i = 0; i < n; ++i) {
    const float y = increment - c;
    const float t = sum + y;
    c = (t - sum) - y;
    sum = t;
  }
  return sum;
}
void setup() {
  Serial.begin(115200);
  delay(2000);
  const unsigned long n = (unsigned long)BB_SUM_COUNT;
  const float increment = (float)BB_INCREMENT;
  const unsigned long t0 = micros();
  const float naive = naiveSum(n, increment);
  const unsigned long t1 = micros();
  const float kahan = kahanSum(n, increment);
  const unsigned long t2 = micros();
  const float mathematical_target = (float)n * increment;
  Serial.print(n); Serial.print(',');
  Serial.print(increment, 10); Serial.print(',');
  Serial.print(naive, 10); Serial.print(',');
  Serial.print(kahan, 10); Serial.print(',');
  Serial.print(mathematical_target, 10); Serial.print(',');
  Serial.print(naive - mathematical_target, 10); Serial.print(',');
  Serial.print(kahan - mathematical_target, 10); Serial.print(',');
  Serial.print((unsigned long)(t1 - t0)); Serial.print(',');
  Serial.println((unsigned long)(t2 - t1));
}
void loop() {}
''')

write("src-tauri/resources/firmware/MPU6050Numerics/MPU6050Numerics.ino", r'''#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#ifndef BB_SAMPLE_INTERVAL_US
#define BB_SAMPLE_INTERVAL_US 20000
#endif

Adafruit_MPU6050 mpu;
const unsigned long SAMPLE_INTERVAL_US = (unsigned long)BB_SAMPLE_INTERVAL_US;
unsigned long last_sample_us = 0;
bool have_previous = false;
float previous_gx = 0.0f;
float theta_rectangle_rad = 0.0f;
float theta_trapezoid_rad = 0.0f;

void setup() {
  Serial.begin(115200);
  if (!mpu.begin()) {
    while (1) delay(100);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
}

void loop() {
  const unsigned long now = micros();
  if ((unsigned long)(now - last_sample_us) < SAMPLE_INTERVAL_US) return;
  const unsigned long dt_us = have_previous ? (unsigned long)(now - last_sample_us) : 0UL;
  last_sample_us = now;

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  const float dt_s = dt_us * 1.0e-6f;
  if (have_previous && dt_s > 0.0f) {
    theta_rectangle_rad += previous_gx * dt_s;
    theta_trapezoid_rad += 0.5f * (previous_gx + g.gyro.x) * dt_s;
  }
  previous_gx = g.gyro.x;
  have_previous = true;

  Serial.print(now); Serial.print(',');
  Serial.print(a.acceleration.x, 6); Serial.print(',');
  Serial.print(a.acceleration.y, 6); Serial.print(',');
  Serial.print(a.acceleration.z, 6); Serial.print(',');
  Serial.print(g.gyro.x, 7); Serial.print(',');
  Serial.print(g.gyro.y, 7); Serial.print(',');
  Serial.print(g.gyro.z, 7); Serial.print(',');
  Serial.print(dt_s, 8); Serial.print(',');
  Serial.print(theta_rectangle_rad, 8); Serial.print(',');
  Serial.print(theta_trapezoid_rad, 8); Serial.print(',');
  Serial.println(theta_trapezoid_rad - theta_rectangle_rad, 8);
}
''')

# ---------------------------------------------------------------------------
# 3. Catalog parameter schema + new recipes.
# ---------------------------------------------------------------------------
catalog_path = ROOT / "src-tauri/resources/recipes/catalog.json"
catalog = json.loads(catalog_path.read_text())
by_id = {item["id"]: item for item in catalog}


def param(key, label, kind, default, macro, minimum=None, maximum=None, step=None, unit=None):
    result = {
        "key": key,
        "label": label,
        "kind": kind,
        "default_value": str(default),
        "macro_name": macro,
    }
    if minimum is not None: result["min"] = minimum
    if maximum is not None: result["max"] = maximum
    if step is not None: result["step"] = step
    if unit is not None: result["unit"] = unit
    return result

by_id["blink"]["parameters"] = [
    param("blink_on_ms", "LED on time", "integer", 500, "BB_BLINK_ON_MS", 10, 5000, 10, "ms"),
    param("blink_off_ms", "LED off time", "integer", 500, "BB_BLINK_OFF_MS", 10, 5000, 10, "ms"),
]
by_id["synthetic"]["parameters"] = [
    param("sample_interval_us", "Sample interval", "integer", 20000, "BB_SAMPLE_INTERVAL_US", 1000, 1000000, 1000, "µs"),
    param("frequency_hz", "Signal frequency", "number", 0.5, "BB_TEST_FREQUENCY_HZ", 0.01, 20, 0.01, "Hz"),
]
by_id["analog_a0"]["parameters"] = [
    param("sample_interval_us", "Sample interval", "integer", 20000, "BB_SAMPLE_INTERVAL_US", 1000, 1000000, 1000, "µs"),
    param("filter_alpha", "Filter α", "number", 0.20, "BB_FILTER_ALPHA", 0.01, 1.0, 0.01, "1"),
    param("adc_reference_v", "Nominal ADC reference", "number", 5.0, "BB_NOMINAL_ADC_REFERENCE_V", 1.0, 5.5, 0.01, "V"),
    param("adc_min_counts", "ADC lower endpoint", "integer", 0, "BB_ADC_MIN_COUNTS", 0, 1022, 1, "count"),
    param("adc_max_counts", "ADC upper endpoint", "integer", 1023, "BB_ADC_MAX_COUNTS", 1, 1023, 1, "count"),
]
by_id["photogate"]["parameters"] = [param("min_edge_spacing_us", "Minimum edge spacing", "integer", 2000, "BB_MIN_EDGE_SPACING_US", 100, 100000, 100, "µs")]
by_id["quadrature_encoder"]["parameters"] = [
    param("counts_per_revolution", "Counts per revolution", "integer", 600, "BB_COUNTS_PER_REVOLUTION", 1, 100000, 1, "count/rev"),
    param("sample_interval_us", "Sample interval", "integer", 10000, "BB_SAMPLE_INTERVAL_US", 1000, 1000000, 1000, "µs"),
]
by_id["pulse_rpm"]["parameters"] = [
    param("pulses_per_revolution", "Pulses per revolution", "number", 1.0, "BB_PULSES_PER_REVOLUTION", 0.1, 1000, 0.1, "pulse/rev"),
    param("min_pulse_spacing_us", "Minimum pulse spacing", "integer", 1000, "BB_MIN_PULSE_SPACING_US", 100, 100000, 100, "µs"),
]

new_recipes = [
    {
        "id":"numerical_derivative","title":"Numerical Error — Step-size Differentiation","category":"Numerical Bench",
        "description":"Sweep h for forward and central differentiation of sin(x) on the MCU to expose truncation-to-roundoff behavior.",
        "sketch_name":"NumericalDerivativeSweep","capture_mode":"numeric","baud":115200,
        "columns":["h","forward","central","mcu_cos","abs_err_forward","abs_err_central"],
        "units":["rad","1","1","1","1","1"],"primary_column":"abs_err_central","sample_rate_hz":None,
        "required_libraries":[],"hardware":["UNO-compatible board","USB data cable"],
        "physical_lab_targets":["Numerical Error Analysis"],
        "notes":["MCU cosf(x) is a convenient onboard comparison; a high-precision host oracle remains the stronger accuracy reference."],
        "boundary":"This is a numerical-method experiment. MCU library output is not an exact mathematical oracle.",
        "parameters":[param("x_value","Evaluation x","number",1.0,"BB_X_VALUE",-6.28,6.28,0.01,"rad")]
    },
    {
        "id":"numerical_cancellation","title":"Numerical Error — Catastrophic Cancellation","category":"Numerical Bench",
        "description":"Compare sqrt(1+x)-1 with its algebraically equivalent stable form as x becomes small.",
        "sketch_name":"NumericalCancellation","capture_mode":"numeric","baud":115200,
        "columns":["x","raw","stable","abs_difference","relative_difference","raw_zero"],
        "units":["1","1","1","1","1","bool"],"primary_column":"raw_zero","sample_rate_hz":None,
        "required_libraries":[],"hardware":["UNO-compatible board","USB data cable"],
        "physical_lab_targets":["Numerical Error Analysis"],"notes":["The two formulas are mathematically equivalent but not equally stable in finite precision."],
        "boundary":"Formula disagreement demonstrates finite-precision sensitivity; use a host oracle for exact error attribution."
    },
    {
        "id":"numerical_accumulation","title":"Numerical Error — Accumulation & Kahan Sum","category":"Numerical Bench",
        "description":"Compare naive repeated addition with Kahan compensated summation under the same AVR floating-point environment.",
        "sketch_name":"NumericalAccumulation","capture_mode":"numeric","baud":115200,
        "columns":["N","increment","naive","kahan","target_float","naive_error","kahan_error","naive_us","kahan_us"],
        "units":["count","1","1","1","1","1","1","us","us"],"primary_column":"kahan_us","sample_rate_hz":None,
        "required_libraries":[],"hardware":["UNO-compatible board","USB data cable"],
        "physical_lab_targets":["Numerical Error Analysis"],"notes":["The printed target is still float arithmetic; BetterBoard host analysis can supply a higher-precision decimal reference."],
        "boundary":"The experiment compares accumulation algorithms and runtime; the MCU-computed target is not an exact oracle.",
        "parameters":[
            param("sum_count","Addition count","integer",20000,"BB_SUM_COUNT",100,50000,100,"count"),
            param("increment","Increment","number",0.001,"BB_INCREMENT",0.000001,1.0,0.000001,"1")
        ]
    },
    {
        "id":"mpu6050_numerics","title":"Numerical Error — MPU6050 Integration","category":"Numerical Bench",
        "description":"Acquire real MPU6050 acceleration/gyro data and compare rectangle and trapezoidal gyro integration on the same discrete samples.",
        "sketch_name":"MPU6050Numerics","capture_mode":"numeric","baud":115200,
        "columns":["time_us","ax_mps2","ay_mps2","az_mps2","gx_rads","gy_rads","gz_rads","dt_s","theta_rect_rad","theta_trap_rad","method_delta_rad"],
        "units":["us","m/s^2","m/s^2","m/s^2","rad/s","rad/s","rad/s","s","rad","rad","rad"],
        "primary_column":"method_delta_rad","sample_rate_hz":50.0,
        "required_libraries":["Adafruit MPU6050","Adafruit Unified Sensor"],
        "hardware":["MPU6050 6-axis IMU","UNO-compatible board","USB data cable"],
        "physical_lab_targets":["Numerical Error Analysis","Oscillation & Integration"],
        "notes":["Gyroscope bias and noise are measurement effects; rectangle-vs-trapezoid disagreement is a numerical-method effect on the same samples."],
        "boundary":"Integrated angle is not absolute orientation truth unless sensor bias, alignment, timing and an independent reference are characterized.",
        "parameters":[param("sample_interval_us","Sample interval","integer",20000,"BB_SAMPLE_INTERVAL_US",5000,200000,1000,"µs")]
    }
]

existing_ids = {item["id"] for item in catalog}
for item in new_recipes:
    if item["id"] not in existing_ids:
        catalog.append(item)

catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")

# Device registry: add confirmed/available classes without guessing motor wiring.
devices_path = ROOT / "src-tauri/resources/devices/devices.json"
devices = json.loads(devices_path.read_text())
existing_device_ids = {item["id"] for item in devices}
for item in [
    {"id":"mpu6050","name":"MPU6050 6-axis accelerometer + gyroscope","interface":"I2C","quantities":["ax","ay","az","gx","gy","gz"],"units":["m/s^2","rad/s"],"libraries":["Adafruit MPU6050","Adafruit Unified Sensor"],"status":"supported"},
    {"id":"pir","name":"PIR motion sensor module","interface":"Digital","quantities":["motion_state","event_time"],"units":["bool","us"],"libraries":[],"status":"supported-template; threshold/retrigger behavior depends on the exact module"},
    {"id":"optical_pulse_module","name":"Optical pulse / motor speed sensor module","interface":"Digital pulse","quantities":["period","frequency","rpm"],"units":["us","Hz","rpm"],"libraries":[],"status":"supported-template; exact optical module geometry and pulses-per-revolution must be confirmed"},
    {"id":"stepper_or_rotary_motor","name":"Stepper / rotary motor hardware","interface":"Driver-dependent","quantities":["command","step","speed"],"units":["1","count","rpm"],"libraries":[],"status":"hardware model and driver must be confirmed before wiring or control assumptions"},
]:
    if item["id"] not in existing_device_ids:
        devices.append(item)
devices_path.write_text(json.dumps(devices, indent=2, ensure_ascii=False) + "\n")

# ---------------------------------------------------------------------------
# 4. Front-end shared recipe parameter controls.
# ---------------------------------------------------------------------------
write("src/RecipeParameterPanel.tsx", r'''import { RotateCcw, SlidersHorizontal } from 'lucide-react';

export type RecipeParameterSpec = {
  key: string;
  label: string;
  kind: 'integer' | 'number' | 'select';
  default_value: string;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  unit?: string | null;
  macro_name: string;
  choices?: string[];
};

export type ParameterizedRecipe = {
  parameters?: RecipeParameterSpec[];
  parameter_values?: Record<string, string>;
};

export function recipeParameterDefaults(recipe?: ParameterizedRecipe | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const spec of recipe?.parameters ?? []) {
    values[spec.key] = recipe?.parameter_values?.[spec.key] ?? spec.default_value;
  }
  return values;
}

type Props = {
  recipe?: ParameterizedRecipe | null;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  compact?: boolean;
};

export default function RecipeParameterPanel({ recipe, values, onChange, compact = false }: Props) {
  const parameters = recipe?.parameters ?? [];
  if (!parameters.length) return <div className="hint">This recipe has no exposed compile-time parameters. Its canonical source remains unchanged.</div>;

  function setValue(key: string, value: string) { onChange({ ...values, [key]: value }); }
  return <div className="recipe-parameter-panel" style={{ marginTop: compact ? 8 : 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
      <div><b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SlidersHorizontal size={15}/> Recipe settings</b><small className="muted">These values are validated and injected into the firmware before compile/upload.</small></div>
      <button className="ghost mini" onClick={() => onChange(recipeParameterDefaults(recipe))}><RotateCcw size={12}/> Defaults</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
      {parameters.map(spec => {
        const value = values[spec.key] ?? spec.default_value;
        if (spec.kind === 'select') return <label key={spec.key}>{spec.label}<select value={value} onChange={event => setValue(spec.key, event.target.value)}>{(spec.choices ?? []).map(choice => <option key={choice}>{choice}</option>)}</select></label>;
        const min = spec.min ?? undefined;
        const max = spec.max ?? undefined;
        const step = spec.step ?? (spec.kind === 'integer' ? 1 : 'any');
        return <div key={spec.key} style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: 10 }}>
          <label style={{ margin: 0 }}>{spec.label}<div style={{ display: 'grid', gridTemplateColumns: '1fr 92px auto', gap: 8, alignItems: 'center', marginTop: 6 }}>
            {min !== undefined && max !== undefined ? <input aria-label={`${spec.label} slider`} type="range" min={min} max={max} step={step} value={Number(value)} onChange={event => setValue(spec.key, event.target.value)} /> : <span/>}
            <input aria-label={`${spec.label} value`} type="number" min={min} max={max} step={step} value={value} onChange={event => setValue(spec.key, event.target.value)} />
            <small>{spec.unit ?? ''}</small>
          </div></label>
          <small className="muted" style={{ display: 'block', marginTop: 5 }}>{spec.macro_name} · default {spec.default_value}</small>
        </div>;
      })}
    </div>
  </div>;
}
''')

write("src/RuntimeLog.tsx", r'''import { useMemo, useState } from 'react';
import { Eraser, TerminalSquare } from 'lucide-react';
import type { BackgroundTask } from './TaskCenter';

type Props = { tasks: BackgroundTask[] };

export default function RuntimeLog({ tasks }: Props) {
  const [filter, setFilter] = useState('');
  const lines = useMemo(() => tasks.flatMap(task => task.logs.map(line => ({
    line, category: task.category, title: task.title, state: task.state,
  }))).filter(item => !filter || `${item.category} ${item.title} ${item.line}`.toLowerCase().includes(filter.toLowerCase())).slice(-300).reverse(), [tasks, filter]);

  return <div className="panel" style={{ marginTop: 14 }}>
    <div className="panel-title" style={{ justifyContent: 'space-between' }}><span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><TerminalSquare size={17}/> Runtime log</span><small className="muted">Task Center / Arduino CLI / monitor / evidence operations</small></div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter runtime log…"/><button className="ghost mini" onClick={() => setFilter('')}><Eraser size={12}/> Clear filter</button></div>
    {!lines.length ? <div className="empty compact">No matching background log lines yet.</div> : <div className="serial-console" style={{ maxHeight: 280 }}>{lines.map((item, index) => <div key={`${item.line}-${index}`}><span>{item.category}</span><code>{item.title} · {item.line}</code></div>)}</div>}
  </div>;
}
''')

write("src/OpenPenguinBridge.tsx", r'''import { useMemo, useState } from 'react';
import { Bot, RefreshCw, Send } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

type Status = { found: boolean; endpoint: string; models: string[]; error?: string | null };
type Props = { context: string };

export default function OpenPenguinBridge({ context }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('Explain the numerical or embedded-system issue in this BetterBoard context and suggest a safe next debugging or experiment step.');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const contextPreview = useMemo(() => context.slice(0, 12000), [context]);

  async function probe() {
    setBusy(true);
    try {
      const next = await invoke<Status>('openguin_probe');
      setStatus(next);
      if (!model && next.models.length) setModel(next.models[0]);
    } catch (error) { setStatus({ found: false, endpoint: '127.0.0.1:11435', models: [], error: String(error) }); }
    finally { setBusy(false); }
  }
  async function ask() {
    if (!model || !prompt.trim()) return;
    setBusy(true);
    try { setAnswer(await invoke<string>('openguin_generate', { model, prompt, context: contextPreview })); }
    catch (error) { setAnswer(`OpenPenguin local AI error: ${error}`); }
    finally { setBusy(false); }
  }

  return <div className="panel" style={{ marginTop: 12 }}>
    <div className="panel-title"><Bot size={18}/> OpenPenguin · Local AI</div>
    <p className="muted">Optional loopback-only bridge to OpenPenguin's private local runtime. BetterBoard only connects to <code>127.0.0.1:11435</code>; it does not upload experiment data to a cloud service.</p>
    <div className="action-row"><button className="ghost" disabled={busy} onClick={() => void probe()}><RefreshCw size={14}/> Connect OpenPenguin</button>{status && <span className={status.found ? 'ok' : 'warn'}>{status.found ? `${status.models.length} local model(s)` : status.error || 'not detected'}</span>}</div>
    {status?.found && <>
      <label>Local model<select value={model} onChange={event => setModel(event.target.value)}>{status.models.map(name => <option key={name}>{name}</option>)}</select></label>
      <label>Ask about this sketch / recipe<textarea style={{ minHeight: 86 }} value={prompt} onChange={event => setPrompt(event.target.value)}/></label>
      <button className="primary" disabled={busy || !model || !prompt.trim()} onClick={() => void ask()}><Send size={14}/> Ask local AI</button>
      {answer && <pre className="terminal" style={{ maxHeight: 260, whiteSpace: 'pre-wrap' }}>{answer}</pre>}
    </>}
  </div>;
}
''')

# ---------------------------------------------------------------------------
# 5. Rust backend: parameter rendering, persistent user library, metadata,
#    and restricted OpenPenguin loopback bridge.
# ---------------------------------------------------------------------------
write("src-tauri/src/openguin_bridge.rs", r'''use serde::Serialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpStream},
    time::Duration,
};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 11435;

#[derive(Debug, Serialize)]
pub struct OpenPenguinStatus {
    found: bool,
    endpoint: String,
    models: Vec<String>,
    error: Option<String>,
}

fn decode_chunked(mut body: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let pos = body.windows(2).position(|w| w == b"\r\n").ok_or("Malformed chunked response")?;
        let size_text = std::str::from_utf8(&body[..pos]).map_err(|e| e.to_string())?;
        let size = usize::from_str_radix(size_text.split(';').next().unwrap_or("0").trim(), 16).map_err(|e| e.to_string())?;
        body = &body[pos + 2..];
        if size == 0 { break; }
        if body.len() < size + 2 { return Err("Truncated chunked response".into()); }
        out.extend_from_slice(&body[..size]);
        body = &body[size + 2..];
    }
    Ok(out)
}

fn request(method: &str, path: &str, body: Option<&str>) -> Result<Vec<u8>, String> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, PORT);
    let mut stream = TcpStream::connect_timeout(&addr.into(), Duration::from_millis(700))
        .map_err(|e| format!("OpenPenguin private runtime is not reachable on {HOST}:{PORT}: {e}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(90))).map_err(|e| e.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(|e| e.to_string())?;
    let payload = body.unwrap_or("");
    let headers = format!(
        "{method} {path} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n",
        payload.as_bytes().len()
    );
    stream.write_all(headers.as_bytes()).map_err(|e| e.to_string())?;
    if !payload.is_empty() { stream.write_all(payload.as_bytes()).map_err(|e| e.to_string())?; }
    stream.flush().map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;
    let split = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or("Invalid HTTP response from OpenPenguin runtime")?;
    let header = String::from_utf8_lossy(&raw[..split]);
    let status = header.lines().next().unwrap_or_default();
    if !status.contains(" 200 ") { return Err(format!("OpenPenguin runtime returned {status}")); }
    let body = &raw[split + 4..];
    if header.to_ascii_lowercase().contains("transfer-encoding: chunked") { decode_chunked(body) } else { Ok(body.to_vec()) }
}

#[tauri::command]
pub fn openguin_probe() -> OpenPenguinStatus {
    match request("GET", "/api/tags", None)
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).map_err(|e| e.to_string())) {
        Ok(value) => {
            let mut models = value.get("models").and_then(Value::as_array).into_iter().flatten()
                .filter_map(|item| item.get("name").and_then(Value::as_str).map(str::to_string)).collect::<Vec<_>>();
            models.sort(); models.dedup();
            OpenPenguinStatus { found: true, endpoint: format!("http://{HOST}:{PORT}"), models, error: None }
        }
        Err(error) => OpenPenguinStatus { found: false, endpoint: format!("http://{HOST}:{PORT}"), models: Vec::new(), error: Some(error) },
    }
}

#[tauri::command]
pub fn openguin_generate(model: String, prompt: String, context: String) -> Result<String, String> {
    if model.trim().is_empty() || model.len() > 200 { return Err("Select a valid local model.".into()); }
    if prompt.trim().is_empty() || prompt.len() > 12_000 { return Err("Prompt must be 1..12000 characters.".into()); }
    if context.len() > 40_000 { return Err("BetterBoard context exceeds the 40000-character local bridge limit.".into()); }
    let combined = format!("You are assisting inside BetterBoard Studio. Keep measurement, numerical and model error distinct.\n\nBETTERBOARD CONTEXT:\n{}\n\nUSER REQUEST:\n{}", context, prompt);
    let body = serde_json::json!({"model": model, "prompt": combined, "stream": false, "options": {"temperature": 0.2}}).to_string();
    let bytes = request("POST", "/api/generate", Some(&body))?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|e| format!("Could not parse local AI response: {e}"))?;
    value.get("response").and_then(Value::as_str).map(str::to_string).ok_or_else(|| "OpenPenguin runtime response did not contain text.".into())
}
''')

lib_rel = "src-tauri/src/lib.rs"
lib = read(lib_rel)
lib = lib.replace("mod serial_stream;", "mod openguin_bridge;\nmod serial_stream;", 1)
lib = lib.replace("use std::{\n    fs,", "use std::{\n    collections::BTreeMap,\n    fs,", 1)

old_recipe = '''#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecipeSpec {
    id: String,
    title: String,
    category: String,
    description: String,
    sketch_name: String,
    capture_mode: String,
    baud: u32,
    columns: Vec<String>,
    units: Vec<String>,
    primary_column: Option<String>,
    sample_rate_hz: Option<f64>,
    required_libraries: Vec<String>,
    hardware: Vec<String>,
    physical_lab_targets: Vec<String>,
    notes: Vec<String>,
    boundary: String,
}
'''
new_recipe = '''#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecipeParameterSpec {
    key: String,
    label: String,
    kind: String,
    default_value: String,
    #[serde(default)] min: Option<f64>,
    #[serde(default)] max: Option<f64>,
    #[serde(default)] step: Option<f64>,
    #[serde(default)] unit: Option<String>,
    macro_name: String,
    #[serde(default)] choices: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecipeSpec {
    id: String,
    title: String,
    category: String,
    description: String,
    sketch_name: String,
    capture_mode: String,
    baud: u32,
    columns: Vec<String>,
    units: Vec<String>,
    primary_column: Option<String>,
    sample_rate_hz: Option<f64>,
    required_libraries: Vec<String>,
    hardware: Vec<String>,
    physical_lab_targets: Vec<String>,
    notes: Vec<String>,
    boundary: String,
    #[serde(default)] parameters: Vec<RecipeParameterSpec>,
    #[serde(default)] user_defined: bool,
    #[serde(default)] base_recipe_id: Option<String>,
    #[serde(default)] parameter_values: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UserRecipeFile {
    spec: RecipeSpec,
    source: String,
}
'''
assert old_recipe in lib
lib = lib.replace(old_recipe, new_recipe, 1)
lib = lib.replace('    firmware_sha256: String,\n', '    firmware_sha256: String,\n    #[serde(default)]\n    recipe_parameters: BTreeMap<String, String>,\n', 1)

start = lib.index("fn recipe_catalog_value()")
end = lib.index("fn sha256_text")
new_catalog_backend = r'''fn recipe_catalog_value() -> Result<Vec<RecipeSpec>, String> {
    serde_json::from_str(RECIPE_CATALOG_JSON)
        .map_err(|e| format!("Invalid embedded recipe catalog: {e}"))
}

fn user_recipe_base_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Documents").join("BetterBoard").join("library");
    }
    std::env::temp_dir().join("BetterBoard").join("library")
}

fn load_user_recipe_files() -> Vec<UserRecipeFile> {
    let base = user_recipe_base_dir();
    if fs::create_dir_all(&base).is_err() { return Vec::new(); }
    let mut result = fs::read_dir(base).ok().into_iter().flatten().filter_map(Result::ok)
        .map(|entry| entry.path()).filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .filter_map(|path| fs::read_to_string(path).ok())
        .filter_map(|text| serde_json::from_str::<UserRecipeFile>(&text).ok()).collect::<Vec<_>>();
    result.sort_by(|a, b| a.spec.title.cmp(&b.spec.title));
    result
}

fn recipe_catalog_all() -> Result<Vec<RecipeSpec>, String> {
    let mut catalog = recipe_catalog_value()?;
    catalog.extend(load_user_recipe_files().into_iter().map(|entry| entry.spec));
    Ok(catalog)
}

fn board_catalog_value() -> Result<Vec<BoardProfile>, String> {
    serde_json::from_str(BOARD_CATALOG_JSON)
        .map_err(|e| format!("Invalid embedded board catalog: {e}"))
}
fn device_catalog_value() -> Result<Vec<DeviceSpec>, String> {
    serde_json::from_str(DEVICE_CATALOG_JSON)
        .map_err(|e| format!("Invalid embedded device catalog: {e}"))
}

fn recipe_by_id(id: &str) -> Result<RecipeSpec, String> {
    recipe_catalog_all()?.into_iter().find(|recipe| recipe.id == id)
        .ok_or_else(|| format!("Unknown recipe: {id}"))
}

fn user_recipe_by_id(id: &str) -> Option<UserRecipeFile> {
    load_user_recipe_files().into_iter().find(|entry| entry.spec.id == id)
}

fn embedded_recipe_source(id: &str) -> Result<&'static str, String> {
    match id {
        "blink" => Ok(include_str!("../resources/firmware/Blink_LED/Blink_LED.ino")),
        "synthetic" => Ok(include_str!("../resources/firmware/SyntheticSignal/SyntheticSignal.ino")),
        "analog_a0" => Ok(include_str!("../resources/firmware/AnalogDAQ/AnalogDAQ.ino")),
        "numerical_embedded" => Ok(include_str!("../resources/firmware/EmbeddedNumericalReliability/EmbeddedNumericalReliability.ino")),
        "numerical_derivative" => Ok(include_str!("../resources/firmware/NumericalDerivativeSweep/NumericalDerivativeSweep.ino")),
        "numerical_cancellation" => Ok(include_str!("../resources/firmware/NumericalCancellation/NumericalCancellation.ino")),
        "numerical_accumulation" => Ok(include_str!("../resources/firmware/NumericalAccumulation/NumericalAccumulation.ino")),
        "mpu6050_numerics" => Ok(include_str!("../resources/firmware/MPU6050Numerics/MPU6050Numerics.ino")),
        "magnetic_mlx90393" => Ok(include_str!("../resources/firmware/MagneticField_MLX90393/MagneticField_MLX90393.ino")),
        "acceleration_adxl345" => Ok(include_str!("../resources/firmware/Accelerometer_ADXL345/Accelerometer_ADXL345.ino")),
        "photogate" => Ok(include_str!("../resources/firmware/PhotogateTimer/PhotogateTimer.ino")),
        "quadrature_encoder" => Ok(include_str!("../resources/firmware/QuadratureEncoder/QuadratureEncoder.ino")),
        "pulse_rpm" => Ok(include_str!("../resources/firmware/PulseRPM/PulseRPM.ino")),
        "random_walk_robot" => Ok(include_str!("../resources/firmware/RandomWalkRobot/RandomWalkRobot.ino")),
        "i2c_scanner" => Ok(include_str!("../resources/firmware/I2CScanner/I2CScanner.ino")),
        _ => Err(format!("No embedded firmware source for recipe: {id}")),
    }
}

fn recipe_source_text(id: &str) -> Result<String, String> {
    if let Some(user) = user_recipe_by_id(id) { return Ok(user.source); }
    Ok(embedded_recipe_source(id)?.to_string())
}

fn normalize_parameter_value(spec: &RecipeParameterSpec, raw: &str) -> Result<String, String> {
    match spec.kind.as_str() {
        "integer" => {
            let value = raw.trim().parse::<i64>().map_err(|_| format!("{} must be an integer", spec.label))?;
            let number = value as f64;
            if spec.min.is_some_and(|min| number < min) || spec.max.is_some_and(|max| number > max) {
                return Err(format!("{} is outside its allowed range", spec.label));
            }
            Ok(value.to_string())
        }
        "number" => {
            let value = raw.trim().parse::<f64>().map_err(|_| format!("{} must be numeric", spec.label))?;
            if !value.is_finite() { return Err(format!("{} must be finite", spec.label)); }
            if spec.min.is_some_and(|min| value < min) || spec.max.is_some_and(|max| value > max) {
                return Err(format!("{} is outside its allowed range", spec.label));
            }
            let mut text = format!("{value:.12}");
            while text.contains('.') && text.ends_with('0') { text.pop(); }
            if text.ends_with('.') { text.push('0'); }
            Ok(text)
        }
        "select" => {
            if !spec.choices.iter().any(|choice| choice == raw) { return Err(format!("{} has an unsupported choice", spec.label)); }
            Ok(raw.to_string())
        }
        other => Err(format!("Unsupported parameter kind: {other}")),
    }
}

fn normalized_parameter_values(recipe: &RecipeSpec, provided: &BTreeMap<String, String>) -> Result<BTreeMap<String, String>, String> {
    for key in provided.keys() {
        if !recipe.parameters.iter().any(|spec| &spec.key == key) { return Err(format!("Unknown parameter for {}: {key}", recipe.title)); }
    }
    let mut result = BTreeMap::new();
    for spec in &recipe.parameters {
        let raw = provided.get(&spec.key).or_else(|| recipe.parameter_values.get(&spec.key)).map(String::as_str).unwrap_or(&spec.default_value);
        result.insert(spec.key.clone(), normalize_parameter_value(spec, raw)?);
    }
    Ok(result)
}

fn render_recipe_source(recipe: &RecipeSpec, provided: &BTreeMap<String, String>) -> Result<String, String> {
    let source = recipe_source_text(&recipe.id)?;
    let values = normalized_parameter_values(recipe, provided)?;
    if values.is_empty() { return Ok(source); }
    let mut prefix = String::from("// BetterBoard compile-time recipe overrides\n");
    for spec in &recipe.parameters {
        let value = values.get(&spec.key).ok_or_else(|| format!("Missing normalized parameter {}", spec.key))?;
        prefix.push_str(&format!("#define {} {}\n", spec.macro_name, value));
    }
    prefix.push('\n');
    prefix.push_str(&source);
    Ok(prefix)
}

fn effective_sample_rate(recipe: &RecipeSpec, values: &BTreeMap<String, String>) -> Option<f64> {
    if let Some(raw) = values.get("sample_interval_us") {
        if let Ok(us) = raw.parse::<f64>() { if us > 0.0 { return Some(1_000_000.0 / us); } }
    }
    recipe.sample_rate_hz
}

'''
lib = lib[:start] + new_catalog_backend + lib[end:]
lib = lib.replace('fn recipe_catalog() -> Result<Vec<RecipeSpec>, String> {\n    recipe_catalog_value()\n}', 'fn recipe_catalog() -> Result<Vec<RecipeSpec>, String> {\n    recipe_catalog_all()\n}', 1)
lib = lib.replace('fn recipe_source(recipe_id: String) -> Result<String, String> {\n    Ok(embedded_recipe_source(&recipe_id)?.to_string())\n}', 'fn recipe_source(recipe_id: String) -> Result<String, String> {\n    recipe_source_text(&recipe_id)\n}', 1)

prep_start = lib.index("#[tauri::command]\nfn prepare_recipe")
prep_end = lib.index("fn developer_sketch_base_dir()")
new_prepare = r'''fn write_prepared_recipe(recipe: &RecipeSpec, parameter_values: &BTreeMap<String, String>) -> Result<String, String> {
    let source = render_recipe_source(recipe, parameter_values)?;
    let root = sketch_root(recipe)?;
    let file = root.join(format!("{}.ino", recipe.sketch_name));
    fs::write(&file, source).map_err(|e| e.to_string())?;
    Ok(root.display().to_string())
}

#[tauri::command]
fn prepare_recipe(recipe_id: String) -> Result<String, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    write_prepared_recipe(&recipe, &BTreeMap::new())
}

#[tauri::command]
fn prepare_recipe_with_params(recipe_id: String, parameter_values: BTreeMap<String, String>) -> Result<String, String> {
    let recipe = recipe_by_id(&recipe_id)?;
    write_prepared_recipe(&recipe, &parameter_values)
}

#[tauri::command]
fn user_recipe_save(title: String, base_recipe_id: String, source: Option<String>, parameter_values: BTreeMap<String, String>) -> Result<RecipeSpec, String> {
    let title = title.trim();
    if title.is_empty() || title.len() > 120 { return Err("User recipe title must be 1..120 characters.".into()); }
    let base_id = base_recipe_id.trim();
    let (mut spec, inherited_source) = if base_id.is_empty() {
        (RecipeSpec {
            id: String::new(), title: title.to_string(), category: "My Library".into(),
            description: "User-authored Arduino sketch saved from BetterBoard Developer.".into(),
            sketch_name: sanitize_developer_sketch_name(title), capture_mode: "none".into(), baud: 115200,
            columns: Vec::new(), units: Vec::new(), primary_column: None, sample_rate_hz: None,
            required_libraries: Vec::new(), hardware: vec!["User-defined hardware".into()],
            physical_lab_targets: Vec::new(), notes: vec!["User-authored recipe; verify its hardware assumptions before use.".into()],
            boundary: "User-authored firmware has no automatic measurement/calibration claim.".into(), parameters: Vec::new(),
            user_defined: true, base_recipe_id: None, parameter_values: BTreeMap::new(),
        }, source.clone().unwrap_or_default())
    } else {
        let base = recipe_by_id(base_id)?;
        let inherited = recipe_source_text(base_id)?;
        let mut derived = base.clone();
        derived.base_recipe_id = Some(base.id.clone());
        derived.description = format!("User recipe derived from {}.", base.title);
        (derived, inherited)
    };
    let source_text = source.unwrap_or(inherited_source);
    if source_text.trim().is_empty() { return Err("User recipe source is empty.".into()); }
    if source_text.len() > 2_000_000 { return Err("User recipe source exceeds the 2 MB limit.".into()); }
    let normalized = normalized_parameter_values(&spec, &parameter_values)?;
    let slug = sanitize_developer_sketch_name(title);
    let id = format!("user_{}_{}", slug.to_lowercase(), Utc::now().timestamp_millis());
    spec.id = id.clone();
    spec.title = title.to_string();
    spec.category = "My Library".into();
    spec.sketch_name = slug;
    spec.user_defined = true;
    spec.parameter_values = normalized;
    let file = UserRecipeFile { spec: spec.clone(), source: source_text };
    let base = user_recipe_base_dir();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let path = base.join(format!("{id}.json"));
    fs::write(&path, serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Could not save user recipe {}: {e}", path.display()))?;
    Ok(spec)
}

'''
lib = lib[:prep_start] + new_prepare + lib[prep_end:]

old_sig = '''fn write_measurement_package(
    recipe: &RecipeSpec,
    port: &str,
    board_profile: &str,
    acquisition_mode: &str,
    valid_rows: &[CapturedRow],
) -> Result<MeasurementResult, String> {'''
new_sig = '''fn write_measurement_package(
    recipe: &RecipeSpec,
    port: &str,
    board_profile: &str,
    acquisition_mode: &str,
    parameter_values: &BTreeMap<String, String>,
    valid_rows: &[CapturedRow],
) -> Result<MeasurementResult, String> {'''
assert old_sig in lib
lib = lib.replace(old_sig, new_sig, 1)
lib = lib.replace('    let source = embedded_recipe_source(&recipe.id)?;\n    let metadata = MeasurementMetadata {', '    let normalized_parameters = normalized_parameter_values(recipe, parameter_values)?;\n    let source = render_recipe_source(recipe, &normalized_parameters)?;\n    let metadata = MeasurementMetadata {', 1)
lib = lib.replace('        sample_rate_hz: recipe.sample_rate_hz,\n        sample_count:', '        sample_rate_hz: effective_sample_rate(recipe, &normalized_parameters),\n        sample_count:', 1)
lib = lib.replace('        firmware_sha256: sha256_text(source),\n', '        firmware_sha256: sha256_text(&source),\n        recipe_parameters: normalized_parameters.clone(),\n', 1)
lib = lib.replace('        "recipe_id": recipe.id,\n        "primary_column":', '        "recipe_id": recipe.id,\n        "recipe_parameters": normalized_parameters,\n        "primary_column":', 1)

lib = lib.replace('''fn capture_measurement(
    port: String,
    duration_ms: u64,
    max_lines: usize,
    board_profile: String,
    recipe_id: String,
) -> Result<MeasurementResult, String> {''', '''fn capture_measurement(
    port: String,
    duration_ms: u64,
    max_lines: usize,
    board_profile: String,
    recipe_id: String,
    parameter_values: Option<BTreeMap<String, String>>,
) -> Result<MeasurementResult, String> {''', 1)
lib = lib.replace('''        "serial-capture",
        &valid_rows,
    )''', '''        "serial-capture",
        &parameter_values.unwrap_or_default(),
        &valid_rows,
    )''', 1)
lib = lib.replace('''fn save_measurement_buffer(
    port: String,
    board_profile: String,
    recipe_id: String,
    rows: Vec<CapturedRow>,
) -> Result<MeasurementResult, String> {''', '''fn save_measurement_buffer(
    port: String,
    board_profile: String,
    recipe_id: String,
    rows: Vec<CapturedRow>,
    parameter_values: Option<BTreeMap<String, String>>,
) -> Result<MeasurementResult, String> {''', 1)
lib = lib.replace('''        "live-monitor-buffer",
        &valid_rows,
    )''', '''        "live-monitor-buffer",
        &parameter_values.unwrap_or_default(),
        &valid_rows,
    )''', 1)
lib = lib.replace('            prepare_recipe,\n            developer_sketch_save,', '            prepare_recipe,\n            prepare_recipe_with_params,\n            user_recipe_save,\n            developer_sketch_save,', 1)
lib = lib.replace('            measurement_session_load,\n            serial_stream::serial_stream_start,', '            measurement_session_load,\n            openguin_bridge::openguin_probe,\n            openguin_bridge::openguin_generate,\n            serial_stream::serial_stream_start,', 1)
write(lib_rel, lib)

# ---------------------------------------------------------------------------
# 6. App: real parameter state, presets, collapsible Library and Developer
#    template/library handoff.
# ---------------------------------------------------------------------------
app_rel = "src/App.tsx"
app = read(app_rel)
app = app.replace("import { useHardwareSession } from './HardwareSession';", "import { useHardwareSession } from './HardwareSession';\nimport RecipeParameterPanel, { recipeParameterDefaults, type RecipeParameterSpec } from './RecipeParameterPanel';", 1)
app = app.replace('''  hardware: string[]; physical_lab_targets: string[]; notes: string[]; boundary: string;
};''', '''  hardware: string[]; physical_lab_targets: string[]; notes: string[]; boundary: string;
  parameters?: RecipeParameterSpec[]; user_defined?: boolean; base_recipe_id?: string | null;
  parameter_values?: Record<string, string>;
};''', 1)
app = app.replace("const libraryGroupFor = (recipe: RecipeSpec) => {\n", "const libraryGroupFor = (recipe: RecipeSpec) => {\n  if (recipe.user_defined) return 'My Library';\n", 1)
app = app.replace("  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);\n", "  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);\n  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});\n  const [presetName, setPresetName] = useState('');\n", 1)
marker = '''  useEffect(() => {
    setSketchDir(''); setMeasurement(null); setPreflight(null);
    if (!recipeId) return;
    invoke<string>('recipe_source', { recipeId }).then(setSource).catch(e => setSource(String(e)));
  }, [recipeId]);
'''
assert marker in app
app = app.replace(marker, marker + '''  useEffect(() => {
    if (!recipe) return;
    setParameterValues(recipeParameterDefaults(recipe));
    setPresetName(`${recipe.title} preset`);
    setSketchDir('');
  }, [recipe?.id]);
''', 1)
app = app.replace("const path = await invoke<string>('prepare_recipe', { recipeId: recipe.id });", "const path = await invoke<string>('prepare_recipe_with_params', { recipeId: recipe.id, parameterValues });", 1)
nav_marker = "  const nav = [\n"
assert nav_marker in app
save_fn = r'''  async function saveRecipePreset() {
    if (!recipe) return;
    const title = presetName.trim() || `${recipe.title} preset`;
    const task = addTask('System', `Save preset · ${title}`, 'Saving parameterized recipe into Documents/BetterBoard/library…');
    try {
      const saved = await invoke<RecipeSpec>('user_recipe_save', {
        title, baseRecipeId: recipe.id, source: null, parameterValues,
      });
      const catalog = await invoke<RecipeSpec[]>('recipe_catalog');
      setRecipes(catalog); setRecipeId(saved.id);
      const detail = `Saved to My Library · ${saved.title}`;
      logTask(task, detail); finishTask(task, 'done', detail); setStatus(detail);
    } catch (error) {
      logTask(task, String(error)); finishTask(task, 'failed', `Preset save failed: ${error}`); setStatus(`Preset save failed: ${error}`);
    }
  }

'''
app = app.replace(nav_marker, save_fn + nav_marker, 1)

schema_marker = '''          {recipe && <div className="schema-row"><span>{recipe.sketch_name}.ino</span><span>{recipe.baud} baud</span><span>{recipe.capture_mode}</span>{recipe.sample_rate_hz && <span>{recipe.sample_rate_hz} Hz</span>}</div>}
          <div className="action-row">'''
assert schema_marker in app
app = app.replace(schema_marker, '''          {recipe && <div className="schema-row"><span>{recipe.sketch_name}.ino</span><span>{recipe.baud} baud</span><span>{recipe.capture_mode}</span>{recipe.sample_rate_hz && <span>{recipe.sample_rate_hz} Hz nominal</span>}</div>}
          {recipe && <RecipeParameterPanel recipe={recipe} values={parameterValues} onChange={values => { setParameterValues(values); setSketchDir(''); }} />}
          {recipe && <div className="action-row" style={{ alignItems: 'end' }}><label style={{ flex: '1 1 260px' }}>Preset name<input value={presetName} onChange={event => setPresetName(event.target.value)} /></label><button className="ghost" disabled={busy} onClick={() => void saveRecipePreset()}><Save size={15}/> Save preset to My Library</button></div>}
          <div className="action-row">''', 1)

old_groups = '''<div className="recipe-list">{groupedRecipes.map(([group, items]) => <div key={group} className="recipe-group"><div className="eyebrow" style={{ margin: '12px 0 6px' }}>{group}</div>{items.map(item => { const Icon = iconFor(item.id); return <button key={item.id} className={`recipe-row ${item.id === recipeId ? 'selected' : ''}`} onClick={() => setRecipeId(item.id)}><Icon size={18}/><div><b>{item.title}</b><span>{item.category} · {item.sketch_name}</span></div><small>{item.capture_mode}</small></button>; })}</div>)}</div>'''
assert old_groups in app
new_groups = '''<div className="recipe-list">{groupedRecipes.map(([group, items]) => <details key={group} className="recipe-group" defaultOpen={group === 'My Library' || group === libraryGroupFor(recipe ?? items[0])}><summary className="eyebrow" style={{ margin: '12px 0 6px', cursor: 'pointer' }}>{group} · {items.length}</summary>{items.map(item => { const Icon = iconFor(item.id); return <button key={item.id} className={`recipe-row ${item.id === recipeId ? 'selected' : ''}`} onClick={() => setRecipeId(item.id)}><Icon size={18}/><div><b>{item.title}</b><span>{item.user_defined ? 'USER PRESET' : item.category} · {item.sketch_name}</span></div><small>{item.capture_mode}</small></button>; })}</details>)}</div>'''
app = app.replace(old_groups, new_groups, 1)

inspector_marker = '''            <div className="info-section"><b>Physical Lab consumers</b>{recipe.physical_lab_targets.map(v => <span key={v}>• {v}</span>)}</div>
            <div className="boundary"><ShieldCheck size={15}/>{recipe.boundary}</div>
            <button className="primary" onClick={() => setTab('hardware')}>Use this recipe</button>'''
assert inspector_marker in app
app = app.replace(inspector_marker, '''            <div className="info-section"><b>Physical Lab consumers</b>{recipe.physical_lab_targets.map(v => <span key={v}>• {v}</span>)}</div>
            <RecipeParameterPanel compact recipe={recipe} values={parameterValues} onChange={values => { setParameterValues(values); setSketchDir(''); }} />
            <div className="boundary"><ShieldCheck size={15}/>{recipe.boundary}</div>
            <div className="action-row"><button className="primary" onClick={() => setTab('hardware')}>Use this recipe</button><button className="ghost" onClick={() => setTab('developer')}><Code2 size={15}/> Open in Developer</button></div>''', 1)

app = app.replace('''        onMeasurement={setMeasurement}
        onTaskStart={addTask}''', '''        onMeasurement={setMeasurement}
        parameterValues={parameterValues}
        tasks={tasks}
        onTaskStart={addTask}''', 1)
app = app.replace('''        integratedDevices={devices.length}
        onStatus={setStatus}''', '''        integratedDevices={devices.length}
        recipes={recipes}
        onLibrarySaved={saved => setRecipes(current => [saved, ...current.filter(item => item.id !== saved.id)])}
        onStatus={setStatus}''', 1)
write(app_rel, app)

# ---------------------------------------------------------------------------
# 7. Developer: template picker + Save to Library + OpenPenguin.
# ---------------------------------------------------------------------------
dev_rel = "src/DeveloperIDE.tsx"
dev = read(dev_rel)
dev = dev.replace("import type { TaskCategory, TaskState } from './TaskCenter';", "import type { TaskCategory, TaskState } from './TaskCenter';\nimport OpenPenguinBridge from './OpenPenguinBridge';", 1)
dev = dev.replace('''  notes: string[];
};''', '''  notes: string[];
  user_defined?: boolean;
  parameter_values?: Record<string, string>;
};''', 1)
dev = dev.replace('''  integratedDevices: number;
  onStatus: (message: string) => void;''', '''  integratedDevices: number;
  recipes: RecipeSpec[];
  onLibrarySaved?: (recipe: RecipeSpec) => void;
  onStatus: (message: string) => void;''', 1)
dev = dev.replace('''  recipe, canonicalSource, cli, fqbn, selectedPort, integratedDevices,
  onStatus, onTaskStart, onTaskLog, onTaskFinish,
}: Props) {''', '''  recipe, canonicalSource, cli, fqbn, selectedPort, integratedDevices, recipes, onLibrarySaved,
  onStatus, onTaskStart, onTaskLog, onTaskFinish,
}: Props) {''', 1)
dev = dev.replace("  const [dirty, setDirty] = useState(false);\n", "  const [dirty, setDirty] = useState(false);\n  const [templateId, setTemplateId] = useState(recipe?.id ?? '');\n", 1)
dev = dev.replace('''    setDirty(false);
  }, [recipe?.id, canonicalSource]);''', '''    setDirty(false);
    setTemplateId(recipe?.id ?? '');
  }, [recipe?.id, canonicalSource]);''', 1)
reset_marker = '''  function resetToRecipe() {
    setSource(canonicalSource || BLANK_SKETCH);
    setSketchName(safeDefaultName(recipe?.sketch_name));
    setSavedDir('');
    setDirty(false);
    setOutput(`Reset editor to canonical ${recipe?.sketch_name || 'blank'} source.`);
  }
'''
assert reset_marker in dev
dev = dev.replace(reset_marker, reset_marker + r'''
  async function loadTemplate() {
    const template = recipes.find(item => item.id === templateId);
    if (!template) { resetToRecipe(); return; }
    try {
      const text = await invoke<string>('recipe_source', { recipeId: template.id });
      setSource(text); setSketchName(safeDefaultName(template.sketch_name)); setSavedDir(''); setDirty(false);
      setOutput(`Loaded recipe template: ${template.title}`);
    } catch (error) { setOutput(`Template load failed: ${error}`); }
  }

  async function saveToLibrary() {
    const task = onTaskStart('System', `Save to Library · ${sketchName}`, 'Saving editable sketch as a BetterBoard user recipe…');
    try {
      const template = recipes.find(item => item.id === templateId);
      const saved = await invoke<RecipeSpec>('user_recipe_save', {
        title: sketchName, baseRecipeId: template?.id ?? recipe?.id ?? '', source,
        parameterValues: template?.parameter_values ?? {},
      });
      onLibrarySaved?.(saved);
      const detail = `Saved user recipe · ${saved.title}`;
      onTaskLog(task, detail); onTaskFinish(task, 'done', detail); onStatus(detail); setOutput(detail);
    } catch (error) {
      const detail = `Save to Library failed: ${error}`;
      onTaskLog(task, detail); onTaskFinish(task, 'failed', detail); onStatus(detail); setOutput(detail);
    }
  }
''', 1)
dev = dev.replace('''<button className="ghost" disabled={busy} onClick={resetToRecipe}><RotateCcw size={15}/> Load recipe</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void saveDraft()}><Save size={15}/> Save</button>''', '''<button className="ghost" disabled={busy} onClick={() => void loadTemplate()}><RotateCcw size={15}/> Load recipe template</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void saveDraft()}><Save size={15}/> Save</button>
        <button className="ghost" disabled={busy || !source.trim()} onClick={() => void saveToLibrary()}><Braces size={15}/> Save to Library</button>''', 1)
dev = dev.replace('''        <div className="developer-filebar">
          <label>Sketch name<input value={sketchName}''', '''        <div className="developer-filebar">
          <label>Template<select value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">Blank / current</option>{recipes.map(item => <option key={item.id} value={item.id}>{item.user_defined ? 'My Library · ' : ''}{item.title}</option>)}</select></label>
          <label>Sketch name<input value={sketchName}''', 1)
side_end = '''          <div className="info-section"><b>Starting recipe notes</b>{recipe?.notes?.length ? recipe.notes.map(note => <span key={note}>• {note}</span>) : <span>• Free sketch mode is not constrained to a recipe.</span>}</div>
        </div>
      </div>'''
assert side_end in dev
dev = dev.replace(side_end, '''          <div className="info-section"><b>Starting recipe notes</b>{recipe?.notes?.length ? recipe.notes.map(note => <span key={note}>• {note}</span>) : <span>• Free sketch mode is not constrained to a recipe.</span>}</div>
        </div>
        <OpenPenguinBridge context={`Recipe: ${recipe?.title || 'free sketch'}\nBoard: ${fqbn}\nPort: ${selectedPort || 'none'}\n\nSketch:\n${source}`} />
      </div>''', 1)
write(dev_rel, dev)

# ---------------------------------------------------------------------------
# 8. Monitor: parameter-aware evidence + runtime log.
# ---------------------------------------------------------------------------
mon_rel = "src/MonitorDataStudio.tsx"
mon = read(mon_rel)
mon = mon.replace("import type { TaskCategory, TaskState } from './TaskCenter';", "import type { BackgroundTask, TaskCategory, TaskState } from './TaskCenter';\nimport RuntimeLog from './RuntimeLog';", 1)
mon = mon.replace('''  onMeasurement?: (measurement: MeasurementResult) => void;
  onTaskStart?:''', '''  onMeasurement?: (measurement: MeasurementResult) => void;
  parameterValues?: Record<string, string>;
  tasks?: BackgroundTask[];
  onTaskStart?:''', 1)
mon = mon.replace('''  recipe, selectedPort, fqbn, latestMeasurement, bridgeDocs, onStatus, onMeasurement,
  onTaskStart, onTaskLog, onTaskFinish,
}: Props) {''', '''  recipe, selectedPort, fqbn, latestMeasurement, bridgeDocs, onStatus, onMeasurement, parameterValues = {}, tasks = [],
  onTaskStart, onTaskLog, onTaskFinish,
}: Props) {''', 1)
mon = mon.replace('''          rows: bufferedEvidenceRows.map(row => ({
            host_timestamp_ms: row.hostTimestampMs,
            line: row.line,
            numeric: row.numeric,
          })),
        });''', '''          rows: bufferedEvidenceRows.map(row => ({
            host_timestamp_ms: row.hostTimestampMs,
            line: row.line,
            numeric: row.numeric,
          })),
          parameterValues,
        });''', 1)
mon = mon.replace('''          boardProfile: fqbn,
          recipeId: recipe.id,
        });''', '''          boardProfile: fqbn,
          recipeId: recipe.id,
          parameterValues,
        });''', 1)
end_marker = "\n  </section>;\n}"
assert end_marker in mon
mon = mon.replace(end_marker, "\n    <RuntimeLog tasks={tasks} />\n  </section>;\n}", 1)
write(mon_rel, mon)

# ---------------------------------------------------------------------------
# 9. Experiments: Advanced is no longer a primary domain. Keep compatibility
#    tools folded beneath the two real domains.
# ---------------------------------------------------------------------------
write("src/ExperimentsHub.tsx", r'''import { useEffect, useState } from 'react';
import { CircuitBoard, Magnet, Settings2, Sigma } from 'lucide-react';
import NumericalBenchSuiteV2 from './NumericalBenchSuiteV2';
import MagnetBenchSuiteV2 from './MagnetBenchSuiteV2';
import NumericalBenchAdvanced from './NumericalBenchAdvanced';
import MagnetBenchAdvanced from './MagnetBenchAdvanced';
import StudioAdvanced from './StudioAdvanced';

type Domain = 'numerical' | 'magnet';
type ExpertDomain = 'studio' | 'numerical' | 'magnet';
type Props = { initialDomain?: Domain };

const DOMAINS = [
  { id: 'numerical' as const, title: 'Numerical Analysis', subtitle: 'sampling · discretization · floating point · embedded reliability', icon: Sigma },
  { id: 'magnet' as const, title: 'Magnetism & Fields', subtitle: 'vector acquisition · characterization · model validation', icon: Magnet },
];

export default function ExperimentsHub({ initialDomain = 'numerical' }: Props) {
  const [domain, setDomain] = useState<Domain>(initialDomain);
  const [expertDomain, setExpertDomain] = useState<ExpertDomain>('numerical');
  useEffect(() => setDomain(initialDomain), [initialDomain]);

  return <div className="experiments-hub">
    <section style={{ maxWidth: 1420, margin: '0 auto', padding: '22px 34px 0' }}>
      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, alignItems: 'center' }}>
          <div><div className="eyebrow">Experiment Library</div><b style={{ display: 'block', marginTop: 4 }}>Choose a domain</b><small className="muted">Essential expert controls now live in the default labs. Legacy full-control surfaces remain folded below as a compatibility escape hatch.</small></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {DOMAINS.map(item => { const Icon = item.icon; const active = item.id === domain; return <button key={item.id} onClick={() => setDomain(item.id)} style={{ minHeight: 68, padding: '10px 12px', borderRadius: 12, border: active ? '1px solid rgba(112,220,255,.42)' : '1px solid rgba(255,255,255,.08)', background: active ? 'linear-gradient(135deg,rgba(59,123,255,.18),rgba(126,140,255,.11))' : 'rgba(255,255,255,.025)', color: '#edf5ff', display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left' }}><span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10, background: active ? 'rgba(112,220,255,.16)' : 'rgba(255,255,255,.04)' }}><Icon size={17}/></span><span><b style={{ display: 'block', fontSize: 12 }}>{item.title}</b><small style={{ display: 'block', color: '#8395aa', marginTop: 3 }}>{item.subtitle}</small></span></button>; })}
          </div>
        </div>
      </div>
    </section>

    {domain === 'numerical' && <NumericalBenchSuiteV2 />}
    {domain === 'magnet' && <MagnetBenchSuiteV2 />}

    <section style={{ maxWidth: 1420, margin: '14px auto 50px', padding: '0 34px' }}>
      <details className="panel">
        <summary style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}><Settings2 size={16}/><b>Expert workflows</b><small className="muted">manual analyzers · exact package paths · classic direct controls</small></summary>
        <p className="muted">This is no longer a third experiment domain. It remains available while useful controls are absorbed into Numerical and Magnet V2.</p>
        <div className="action-row"><button className={expertDomain === 'studio' ? 'primary' : 'ghost'} onClick={() => setExpertDomain('studio')}><CircuitBoard size={15}/> Studio expert</button><button className={expertDomain === 'numerical' ? 'primary' : 'ghost'} onClick={() => setExpertDomain('numerical')}><Sigma size={15}/> Numerical expert</button><button className={expertDomain === 'magnet' ? 'primary' : 'ghost'} onClick={() => setExpertDomain('magnet')}><Magnet size={15}/> Magnet expert</button></div>
        {expertDomain === 'studio' && <StudioAdvanced />}
        {expertDomain === 'numerical' && <NumericalBenchAdvanced />}
        {expertDomain === 'magnet' && <MagnetBenchAdvanced />}
      </details>
    </section>
  </div>;
}
''')

# ---------------------------------------------------------------------------
# 10. Self-check updates: expand rather than weaken old contracts.
# ---------------------------------------------------------------------------
self_rel = "scripts/self_check.py"
self_text = read(self_rel)
self_text = self_text.replace("LEARNING = ROOT / 'src' / 'LearningHub.tsx'\nMAIN = ROOT / 'src' / 'main.tsx'", "LEARNING = ROOT / 'src' / 'LearningHub.tsx'\nRECIPE_PARAMETERS = ROOT / 'src' / 'RecipeParameterPanel.tsx'\nRUNTIME_LOG = ROOT / 'src' / 'RuntimeLog.tsx'\nOPENGUIN_BRIDGE = ROOT / 'src' / 'OpenPenguinBridge.tsx'\nMAIN = ROOT / 'src' / 'main.tsx'", 1)
expected_start = self_text.index("EXPECTED = {")
expected_end = self_text.index("\n}\n\nV04_BYTE_IDENTICAL", expected_start) + 3
expected_new = '''EXPECTED = {
    'blink': ('Blink_LED', 'Blink_LED.ino'),
    'synthetic': ('SyntheticSignal', 'SyntheticSignal.ino'),
    'analog_a0': ('AnalogDAQ', 'AnalogDAQ.ino'),
    'numerical_embedded': ('EmbeddedNumericalReliability', 'EmbeddedNumericalReliability.ino'),
    'numerical_derivative': ('NumericalDerivativeSweep', 'NumericalDerivativeSweep.ino'),
    'numerical_cancellation': ('NumericalCancellation', 'NumericalCancellation.ino'),
    'numerical_accumulation': ('NumericalAccumulation', 'NumericalAccumulation.ino'),
    'mpu6050_numerics': ('MPU6050Numerics', 'MPU6050Numerics.ino'),
    'magnetic_mlx90393': ('MagneticField_MLX90393', 'MagneticField_MLX90393.ino'),
    'acceleration_adxl345': ('Accelerometer_ADXL345', 'Accelerometer_ADXL345.ino'),
    'photogate': ('PhotogateTimer', 'PhotogateTimer.ino'),
    'quadrature_encoder': ('QuadratureEncoder', 'QuadratureEncoder.ino'),
    'pulse_rpm': ('PulseRPM', 'PulseRPM.ino'),
    'random_walk_robot': ('RandomWalkRobot', 'RandomWalkRobot.ino'),
    'i2c_scanner': ('I2CScanner', 'I2CScanner.ino'),
}
'''
self_text = self_text[:expected_start] + expected_new + self_text[expected_end:]
v_start = self_text.index("V04_BYTE_IDENTICAL = {")
v_end = self_text.index("\n}\n\n", v_start) + 3
self_text = self_text[:v_start] + "V04_BYTE_IDENTICAL = {\n    'acceleration_adxl345',\n    'random_walk_robot',\n    'i2c_scanner',\n}\n" + self_text[v_end:]
self_text = self_text.replace("assert len(catalog) == 11, len(catalog)\n    assert len({r['id'] for r in catalog}) == 11", "assert len(catalog) == 15, len(catalog)\n    assert len({r['id'] for r in catalog}) == 15", 1)
self_text = self_text.replace("assert any(d['id'] == 'mlx90393' for d in devices)", "assert any(d['id'] == 'mlx90393' for d in devices)\n    for device_id in ['mpu6050', 'pir', 'optical_pulse_module', 'stepper_or_rotary_motor']:\n        assert any(d['id'] == device_id for d in devices), device_id", 1)
self_text = self_text.replace("HARDWARE_SESSION, OBSERVATORY, LEARNING, MAIN,", "HARDWARE_SESSION, OBSERVATORY, LEARNING, RECIPE_PARAMETERS, RUNTIME_LOG, OPENGUIN_BRIDGE, MAIN,", 1)
self_text = self_text.replace("EXPERIMENTS_HUB, HARDWARE_SESSION, OBSERVATORY, LEARNING, MAIN,", "EXPERIMENTS_HUB, HARDWARE_SESSION, OBSERVATORY, LEARNING, RECIPE_PARAMETERS, RUNTIME_LOG, OPENGUIN_BRIDGE, MAIN,", 1)
self_text = self_text.replace("    print('- 11 canonical recipes registered')", "    print('- 15 canonical recipes registered, including four new numerical-error programs')", 1)
insert_before_package = "    package = json.loads((ROOT / 'package.json').read_text())"
assert insert_before_package in self_text
self_text = self_text.replace(insert_before_package, '''    # Parameterized recipes / user library / local AI are first-class contracts.
    for rid in ['blink', 'synthetic', 'analog_a0', 'photogate', 'quadrature_encoder', 'pulse_rpm', 'numerical_derivative', 'numerical_accumulation', 'mpu6050_numerics']:
        assert by_id[rid].get('parameters'), rid
    for token in ['prepare_recipe_with_params', 'user_recipe_save', 'recipe_parameters', 'Documents', 'BetterBoard', 'library']:
        assert token in rust, token
    for token in ['Recipe settings', 'Save preset to My Library', 'My Library']:
        assert token in app_text, token
    developer_text = (ROOT / 'src' / 'DeveloperIDE.tsx').read_text()
    for token in ['Template', 'Load recipe template', 'Save to Library', 'OpenPenguinBridge']:
        assert token in developer_text, token
    assert 'Runtime log' in RUNTIME_LOG.read_text()
    for token in ['openguin_probe', 'openguin_generate', '127.0.0.1:11435']:
        assert token in OPENGUIN_BRIDGE.read_text() or token in (ROOT / 'src-tauri' / 'src' / 'openguin_bridge.rs').read_text(), token
    assert 'Expert workflows' in hub and 'Advanced Tools' not in hub

''' + insert_before_package, 1)
write(self_rel, self_text)

func_rel = "scripts/functionality_surface_check.py"
func = read(func_rel)
func = func.replace("    'Learning': SRC / 'LearningHub.tsx',", "    'Learning': SRC / 'LearningHub.tsx',\n    'Recipe Parameters': SRC / 'RecipeParameterPanel.tsx',\n    'Runtime Log': SRC / 'RuntimeLog.tsx',\n    'OpenPenguin Bridge': SRC / 'OpenPenguinBridge.tsx',", 1)
func = func.replace("for token in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'Advanced Tools']:", "for token in ['NumericalBenchSuiteV2', 'MagnetBenchSuiteV2', 'Expert workflows']:", 1)
func = func.replace("    assert token in hub, f'Experiments Hub lost {token}'", "    assert token in hub, f'Experiments Hub lost {token}'\nassert 'Advanced Tools' not in hub, 'Advanced Tools regressed into a third primary experiment domain'", 1)
print_marker = "print('BetterBoard functionality surface check: PASS')"
assert print_marker in func
new_contract = r'''# Parameterized Recipe → compile → evidence and user-library loops are protected.
parameter_panel = (SRC / 'RecipeParameterPanel.tsx').read_text()
runtime_log = (SRC / 'RuntimeLog.tsx').read_text()
openguin = (SRC / 'OpenPenguinBridge.tsx').read_text()
for token in ['Recipe settings', 'slider', 'macro_name', 'Defaults']:
    assert token in parameter_panel, f'Recipe parameter UI lost {token}'
for token in ['prepare_recipe_with_params', 'user_recipe_save', 'Save preset to My Library', 'My Library']:
    assert token in app + rust, f'Parameterized/user recipe loop lost {token}'
for token in ['Load recipe template', 'Save to Library', 'OpenPenguinBridge']:
    assert token in developer, f'Developer template/library loop lost {token}'
for token in ['Runtime log', 'Task Center / Arduino CLI / monitor / evidence operations']:
    assert token in runtime_log, f'Runtime log lost {token}'
for token in ['Connect OpenPenguin', '127.0.0.1:11435', 'Ask local AI']:
    assert token in openguin, f'OpenPenguin UI bridge lost {token}'
for token in ['openguin_probe', 'openguin_generate', 'Ipv4Addr::LOCALHOST']:
    assert token in rust or token in (ROOT / 'src-tauri' / 'src' / 'openguin_bridge.rs').read_text(), f'OpenPenguin backend lost {token}'
for token in ['numerical_derivative', 'numerical_cancellation', 'numerical_accumulation', 'mpu6050_numerics']:
    assert token in rust, f'New numerical recipe backend lost {token}'

'''
func = func.replace(print_marker, new_contract + print_marker, 1)
write(func_rel, func)

# Documentation for the new product contract.
write("docs/PARAMETERIZED_RECIPES.md", r'''# Parameterized Recipes and My Library

BetterBoard recipes now have two layers:

1. **Canonical recipes** — versioned, reproducible starting points bundled with the app.
2. **My Library** — user presets or Developer-derived sketches saved under `~/Documents/BetterBoard/library`.

Exposed recipe parameters are not display-only settings. BetterBoard validates them, injects compile-time `BB_*` macros into the firmware source, compiles that rendered source, and records the effective values in Measurement Evidence metadata.

Developer follows the same loop:

`Recipe template → edit .ino → Verify / Run → Save to Library → reuse later`

The optional OpenPenguin bridge is loopback-only and targets the private local runtime at `127.0.0.1:11435`. BetterBoard does not use this bridge to upload experiment data to a remote service.
''')

print("Parameterized recipes / My Library / Developer template / Runtime Log / OpenPenguin refactor applied")
