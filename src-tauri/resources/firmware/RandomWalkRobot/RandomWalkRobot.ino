// Physical Lab Random Walk Robot
// Low-speed tabletop stochastic-motion experiment.
//
// Arduino generates bounded random motion commands.
// Scientific trajectory data should preferably come from camera/object tracking
// or calibrated position sensing rather than motor command time.
//
// IMPORTANT:
// Pin definitions below are placeholders for a small low-voltage dual motor driver.
// Adjust only after the exact motor driver is identified.

const uint8_t LEFT_PWM  = 5;
const uint8_t LEFT_DIR  = 4;
const uint8_t RIGHT_PWM = 6;
const uint8_t RIGHT_DIR = 7;

const uint8_t MAX_PWM = 100; // intentionally conservative
const unsigned long MIN_MOVE_MS = 250;
const unsigned long MAX_MOVE_MS = 650;

// Apparatus-specific. Must be calibrated for the actual robot.
// This is only a nominal starting constant.
const unsigned long TURN_MS_90 = 250;

unsigned long step_index = 0;

void setMotor(uint8_t pwmPin, uint8_t dirPin, int command) {
  const bool forward = command >= 0;
  int magnitude = abs(command);
  if (magnitude > MAX_PWM) magnitude = MAX_PWM;

  digitalWrite(dirPin, forward ? HIGH : LOW);
  analogWrite(pwmPin, magnitude);
}

void stopRobot() {
  analogWrite(LEFT_PWM, 0);
  analogWrite(RIGHT_PWM, 0);
}

void turnInPlace(int direction, unsigned long duration_ms) {
  setMotor(LEFT_PWM, LEFT_DIR, direction * MAX_PWM);
  setMotor(RIGHT_PWM, RIGHT_DIR, -direction * MAX_PWM);
  delay(duration_ms);
  stopRobot();
}

void moveForward(unsigned long duration_ms) {
  setMotor(LEFT_PWM, LEFT_DIR, MAX_PWM);
  setMotor(RIGHT_PWM, RIGHT_DIR, MAX_PWM);
  delay(duration_ms);
  stopRobot();
}

void setup() {
  pinMode(LEFT_PWM, OUTPUT);
  pinMode(LEFT_DIR, OUTPUT);
  pinMode(RIGHT_PWM, OUTPUT);
  pinMode(RIGHT_DIR, OUTPUT);
  stopRobot();

  Serial.begin(115200);

  // Replace with a fixed seed when a reproducible run is required.
  randomSeed(analogRead(A0));
}

void loop() {
  const long choice = random(0, 4);
  int turn_quarters = 0;

  if (choice == 1) {
    turn_quarters = -1;
    turnInPlace(-1, TURN_MS_90);
  } else if (choice == 2) {
    turn_quarters = 1;
    turnInPlace(1, TURN_MS_90);
  } else if (choice == 3) {
    turn_quarters = 2;
    turnInPlace(1, 2UL * TURN_MS_90);
  }

  const unsigned long move_ms =
      random(MIN_MOVE_MS, MAX_MOVE_MS + 1);

  moveForward(move_ms);
  ++step_index;

  // time_ms,step_index,turn_quarters,move_ms
  Serial.print(millis());
  Serial.print(',');
  Serial.print(step_index);
  Serial.print(',');
  Serial.print(turn_quarters);
  Serial.print(',');
  Serial.println(move_ms);

  delay(250);
}
