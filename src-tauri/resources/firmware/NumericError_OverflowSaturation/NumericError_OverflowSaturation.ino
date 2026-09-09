#include <Arduino.h>
#include <limits.h>

// BetterBoard Numeric Error — Overflow / Saturation V2
// Separates mathematical reference arithmetic, unsigned wraparound and
// explicit saturation. Signed overflow is never invoked directly.

const uint32_t BAUD = 115200;

uint16_t satAddU16(uint16_t a, uint16_t b) {
  const uint32_t wide = (uint32_t)a + (uint32_t)b;
  return wide > UINT16_MAX ? UINT16_MAX : (uint16_t)wide;
}

int16_t satAddI16(int16_t a, int16_t b) {
  const int32_t wide = (int32_t)a + (int32_t)b;
  if (wide > INT16_MAX) return INT16_MAX;
  if (wide < INT16_MIN) return INT16_MIN;
  return (int16_t)wide;
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  Serial.println("NUMERIC_ERROR_OVERFLOW_SATURATION_V2");
  Serial.println("domain,case_id,a,b,wide_reference,wrapped_or_na,saturated,wrap_error,saturation_error");

  const uint16_t ua[] = {65000U, 65530U, 40000U, 1000U};
  const uint16_t ub[] = {1000U, 20U, 40000U, 2000U};
  for (uint8_t i = 0; i < 4; ++i) {
    const uint32_t wide = (uint32_t)ua[i] + (uint32_t)ub[i];
    const uint16_t wrapped = (uint16_t)(ua[i] + ub[i]);
    const uint16_t saturated = satAddU16(ua[i], ub[i]);
    const int32_t wrapError = (int32_t)wrapped - (int32_t)wide;
    const int32_t saturationError = (int32_t)saturated - (int32_t)wide;

    Serial.print("u16,"); Serial.print(i); Serial.print(',');
    Serial.print(ua[i]); Serial.print(',');
    Serial.print(ub[i]); Serial.print(',');
    Serial.print(wide); Serial.print(',');
    Serial.print(wrapped); Serial.print(',');
    Serial.print(saturated); Serial.print(',');
    Serial.print(wrapError); Serial.print(',');
    Serial.println(saturationError);
  }

  const int16_t sa[] = {30000, 32000, -30000, -32000, 1000};
  const int16_t sb[] = {10000, 2000, -10000, -2000, 2000};
  for (uint8_t i = 0; i < 5; ++i) {
    const int32_t wide = (int32_t)sa[i] + (int32_t)sb[i];
    const int16_t saturated = satAddI16(sa[i], sb[i]);
    const int32_t saturationError = (int32_t)saturated - wide;

    Serial.print("i16,"); Serial.print(100 + i); Serial.print(',');
    Serial.print(sa[i]); Serial.print(',');
    Serial.print(sb[i]); Serial.print(',');
    Serial.print(wide); Serial.print(',');
    Serial.print("NA,");
    Serial.print(saturated); Serial.print(',');
    Serial.print("NA,");
    Serial.println(saturationError);
  }

  Serial.println("CAMPAIGN_COMPLETE");
}

void loop() { delay(1000); }
