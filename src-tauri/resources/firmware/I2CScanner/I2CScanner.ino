#include <Wire.h>

// Diagnostic utility only.
// Text output is intentional here; do NOT use this sketch for Physical Lab capture.

void setup() {
  Serial.begin(115200);
  Wire.begin();
}

void loop() {
  byte count = 0;

  for (byte address = 1; address < 127; ++address) {
    Wire.beginTransmission(address);
    const byte error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device at 0x");
      if (address < 16) Serial.print('0');
      Serial.println(address, HEX);
      ++count;
    }
  }

  Serial.print("Devices found: ");
  Serial.println(count);
  delay(3000);
}
