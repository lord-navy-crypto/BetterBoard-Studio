# Engineering Lab v2 Review Checklist

For each enhanced experiment, reviewers should answer:

- Is the original/raw observable still available?
- Can every derived column be reconstructed from documented inputs?
- Are units unambiguous and catalog-aligned?
- Does the timestamp correspond closely enough to acquisition for the intended analysis?
- Can stale, failed, saturated, or otherwise invalid sensor data be distinguished from valid data?
- Are calibration constants and coordinate conventions discoverable?
- Does the firmware avoid making model-validation or scientific-conclusion claims?
- Does the experiment remain practical on the smallest supported board?

A v2 experiment is stronger when downstream Engineering Lab analysis has *more evidence and fewer hidden assumptions*, not merely more columns.
