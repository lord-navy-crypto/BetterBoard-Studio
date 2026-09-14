#include <BetterBoard.h>

using namespace betterboard;

math::OnlineStatistics online_stats;
signal::EwmaMonitor ewma(0.2);
signal::CusumDetector cusum(512.0, 2.0, 40.0);
math::QuadraticRegression quadratic_fit;
math::SequentialPlanner<16> planner(math::PlanningModel::Quadratic);
math::SmallFFT<8> spectrum;

static const double kCalibrationX[] = {-3, -2, -1, 0, 1, 2, 3};
static const double kCalibrationY[] = {8.5, 5.0, 2.5, 1.0, 0.5, 1.0, 2.5};

static void printCapabilities() {
  const auto caps = math::currentMathRuntimeCapabilities();
  Serial.print("#BB_MATH_CAPS,");
  Serial.print(caps.protocol_version); Serial.print(',');
  Serial.print(caps.profile); Serial.print(',');
  Serial.print(caps.recommended_fft_points); Serial.print(',');
  Serial.print(caps.recommended_window_points); Serial.print(',');
  Serial.print(caps.recommended_planner_observations); Serial.print(',');
  Serial.print(caps.robust_statistics ? 1 : 0); Serial.print(',');
  Serial.print(caps.uncertainty_budget ? 1 : 0); Serial.print(',');
  Serial.print(caps.autocorrelation ? 1 : 0); Serial.print(',');
  Serial.print(caps.small_fft ? 1 : 0); Serial.print(',');
  Serial.print(caps.quadratic_regression ? 1 : 0); Serial.print(',');
  Serial.print(caps.model_diagnostics ? 1 : 0); Serial.print(',');
  Serial.print(caps.change_detection ? 1 : 0); Serial.print(',');
  Serial.println(caps.sequential_planning ? 1 : 0);
}

void setup() {
  Serial.begin(115200);
  for (size_t i = 0; i < 7; ++i) {
    quadratic_fit.push(kCalibrationX[i], kCalibrationY[i]);
    planner.push(kCalibrationX[i]);
  }

  const auto fit = quadratic_fit.result();
  math::CandidateScore next{};
  planner.score(2.5, next);

  Serial.println("#BETTERBOARD_MATH_RUNTIME/1");
  printCapabilities();
  Serial.print("FIT,"); Serial.print(fit.intercept, 6); Serial.print(',');
  Serial.print(fit.linear, 6); Serial.print(','); Serial.println(fit.quadratic, 6);
  Serial.print("DOE,"); Serial.print(next.x, 6); Serial.print(',');
  Serial.print(next.information_gain, 6); Serial.print(','); Serial.println(next.coverage_distance, 6);
}

void loop() {
  const double sample = static_cast<double>(analogRead(A0));
  online_stats.push(sample);
  const double smoothed = ewma.push(sample);
  const bool changed = cusum.update(sample);

  if (!spectrum.ready()) spectrum.push(static_cast<float>(sample));
  if (spectrum.ready()) {
    spectrum.transform();
    Serial.print("FFT_BIN,"); Serial.println(static_cast<unsigned long>(spectrum.dominantBin()));
    spectrum.reset();
  }

  Serial.print("SAMPLE,");
  Serial.print(sample, 3); Serial.print(',');
  Serial.print(smoothed, 3); Serial.print(',');
  Serial.print(online_stats.mean(), 3); Serial.print(',');
  Serial.println(changed ? 1 : 0);
  delay(20);
}
