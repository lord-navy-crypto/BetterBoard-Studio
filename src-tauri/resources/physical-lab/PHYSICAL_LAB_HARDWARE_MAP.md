# Physical Lab hardware mapping

## Strong direct/analogue mappings

RADIA Magnet Studio
  real magnet -> MLX90393 -> Bx,By,Bz -> measured/model field comparison

Radiation Platform
  measured B(z) -> field/trajectory model -> radiation prediction
  (not direct ionizing-radiation measurement)

Oscillation & Integration
  pendulum/oscillator -> photogate / encoder / accelerometer -> period, angle, acceleration

Nonlinear Dynamics & Chaos
  pendulum/double-pendulum analogue -> encoder / photogate / accelerometer
  -> finite-window indicators, spectrum, transitions

Random Walk & Monte Carlo
  small low-speed robot -> stochastic motion
  camera/object tracking -> actual x(t),y(t)
  -> MSD, diffusion-like scaling, first-passage statistics

Multilayer Honeycomb Lattice
  mechanical honeycomb analogue -> accelerometer
  -> vibration spectrum / resonance peak shifts / defect response
  Label as mechanical analogue unless a full SI mapping is established.

Chrono::Modal
  real beam/frame/structure -> accelerometer
  -> measured modal frequencies and response
  -> compare to Chrono modal calculation

Numerical Error Analysis
  reuses measured time series from the above experiments
  -> numerical differentiation/integration/noise/cancellation studies

## Do not force Arduino where it does not belong

Ising Monte Carlo
  no dedicated Arduino path for the current dimensionless model

Kerr Geodesics
  external astrophysical observation/reference data

Sun-Jupiter-Saturn
  external ephemeris/reference data

VAMPIRE
  deferred

Kohn-Sham / DFT
  not present in current Physical Lab main;
  if added later, spectroscopy/material datasets are more appropriate than Arduino
