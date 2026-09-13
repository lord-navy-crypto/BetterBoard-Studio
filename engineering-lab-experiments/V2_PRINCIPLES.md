# Engineering Lab Enhancement Principles

The enhancement era follows five rules.

**Preserve evidence.** Raw or closest-practical sensor observations remain available when derived values are added.

**Expose imperfection.** Missing reads, stale values, timing skew, saturation, and calibration assumptions should become visible rather than silently cleaned away.

**Prefer reconstructable derivations.** Firmware-side derived values should have equations and inputs that downstream tools can audit.

**Respect constrained hardware.** Improvements must remain practical on supported microcontrollers; richer evidence is not permission for uncontrolled RAM, flash, or blocking-time growth.

**Keep judgment downstream.** BetterBoard measures and describes. Engineering Lab calibrates, compares against models, quantifies residuals/uncertainty, and draws scientific conclusions.
