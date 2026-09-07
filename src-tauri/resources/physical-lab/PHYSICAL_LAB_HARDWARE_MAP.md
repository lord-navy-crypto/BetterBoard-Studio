# Physical Lab hardware mapping

## Strong direct/analogue mappings

RADIA Magnet Studio
  Magnet Bench 01: real magnet -> confirmed MLX90393 -> Bx,By,Bz,|B| -> BetterBoard measurement package
  Magnet Bench 02: ambient baseline + fixed-position captures -> corrected B(x/y/z), repeatability, gradients, field integral
  Magnet Bench 03: measured field profile <-> RADIA/model field profile -> residuals, MAE/RMSE/bias/R²,
                   affine discrepancy fit, residual-guided follow-up positions
  Control sensor orientation, coordinate origin, scan path, magnet polarity/orientation and distance reference.
  A field measurement at one geometry is not a universal intrinsic "magnet strength" value.

Radiation Platform
  measured B(z) -> field/trajectory model -> radiation prediction
  (not direct ionizing-radiation measurement)
  Real-magnet evidence can enter this chain only after the magnetic measurement/model registration is explicit.

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
  Numerical Bench 01: real analog acquisition
  Numerical Bench 02: measured time series -> sampling/discretization/integration/differentiation evidence
  Numerical Bench 03: real MCU Taylor arithmetic -> host-oracle reliability comparison

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
