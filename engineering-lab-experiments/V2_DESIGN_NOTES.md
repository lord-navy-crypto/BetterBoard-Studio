# Engineering Lab v2 Design Notes

The first enhancement batch intentionally avoids aggressive filtering or automatic interpretation. Those can make plots look cleaner while destroying evidence about what the instrument actually observed.

The preferred order is:

1. preserve raw observation;
2. preserve timing and configuration;
3. expose deterministic derived observables useful for analysis;
4. expose failure/quality state;
5. perform calibration, filtering choices, model comparison, and inference downstream.

This ordering is especially important for BetterBoard because the same acquisition firmware may feed different Engineering Lab analyses. Keeping the firmware evidence-oriented prevents one experiment's assumptions from silently becoming another experiment's data.
