// Physical Lab — Arduino UNO first hardware test
// Purpose: verify Mac -> USB -> Arduino upload and execution.
//
// Expected result after successful upload:
// the onboard LED marked "L" blinks every 0.5 second.

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);

  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
