// BetterBoard / Physical Lab — Arduino UNO programming-path test
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
