# EL_Chaos_Encoder_Kinematics

Streams quadrature-encoder kinematics for Nonlinear Dynamics & Chaos experiments.

## v2 observables

The stream retains raw count, unwrapped angle, angular velocity, and angular acceleration and adds:

- `revolutions`: signed cumulative revolutions from the raw encoder count
- `phase_rad`: angle wrapped into `[0, 2π)`

Keeping both unwrapped angle and wrapped phase supports trajectory and phase-space analysis while preserving the raw count needed to audit the conversion. These are kinematic observables only; identifying periodicity, bifurcation, or chaos remains an Engineering Lab analysis task.
