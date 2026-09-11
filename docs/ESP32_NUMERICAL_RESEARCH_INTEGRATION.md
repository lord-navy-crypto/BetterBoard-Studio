# BetterBoard ESP32 Numerical Research Integration

Status: **integrated on the research branch; real-board validation still required before canonical promotion**.

This document records the reviewed subset promoted from `docs/drafts/` into BetterBoard Studio. The draft files remain in place as design history and backlog; they are not all claims of implemented functionality.

## What is now integrated

BetterBoard Studio now carries explicit board profiles for generic classic ESP32, ESP32-S3, and ESP32-C3 Arduino-core targets. Profile selection remains explicit because USB serial identity is not a reliable substitute for exact board identification. ESP32 GPIO is treated as a 3.3 V logic domain and board-specific pin maps remain outside these no-GPIO numerical recipes.

The Recipe Library now registers four research-stage recipes:

- `esp32_readiness` — toolchain/runtime/precision/timing readiness probe.
- `esp32_numerical_suite` — precision, Kahan summation, summation order, Taylor range reduction, jitter, Wi-Fi interference, timer overhead, grouping/multicore and optional PSRAM studies.
- `esp32_concurrency_numerics` — reduction grouping, FreeRTOS task/core placement and load-jitter studies.
- `esp32_irregular_dt` — constant-dt versus measured-dt differentiation/integration under IDLE, LOAD and WIFI conditions.

All four are marked `research_stage: true` and declare `supported_cores: ["esp32:esp32"]`. Canonical AVR recipes are deliberately blocked when an ESP32 core is selected until a recipe-specific capability/pin adapter is reviewed.

## Studio behavior

BetterBoard exposes a dedicated ESP32 Research workspace in addition to the generic Hardware/Recipe path. The workspace filters to ESP32 research recipes and board profiles, performs preflight/compile/upload, sends command presets through BetterBoard's own `serial_exchange` path, keeps a bounded in-session run history, and parses tagged research rows.

The live workspace now has two interpretation layers:

1. MCU-reported summaries such as RMS lateness, grouping deltas and deadline misses.
2. Lightweight independent desktop references for supported deterministic arithmetic, Taylor/sine and irregular-dt experiments.

BetterBoard also exposes a dedicated **ESP32 Campaign** workspace for repeated matched-condition studies. It supports the Numerical Reliability Suite, Concurrency Numerics, and Irregular-dt Numerics. Campaign plans carry explicit period/sample/frequency parameters and rotate condition order between repeats instead of always running IDLE first. This reduces simple first-to-last drift bias while remaining deterministic; it is not randomized or blinded experimental design.

The Campaign workspace executes one research command at a time through the same BetterBoard serial path, stops on protocol/serial errors instead of silently mixing invalid evidence into the campaign, and supports cancellation after the current exchange finishes. Its first-pass aggregation reports per-condition mean, sample standard deviation, min/max, and LOAD/IDLE or WIFI/IDLE ratios. JITTER campaigns use RMS lateness as their primary metric; IRREG campaigns currently use timestamp-spacing RMSE. Those metric families are deliberately not treated as interchangeable.

### Runtime provenance gate

Before any campaign condition command runs, BetterBoard now performs a provenance preflight:

1. send `INFO` and require a complete `#INFO_BEGIN` / `#INFO_END` envelope;
2. require at least a runtime `CHIP_MODEL` identity field;
3. send `SCHEMA` and require the observed schema prefix to match the selected BetterBoard research recipe;
4. fetch the source embedded in the running BetterBoard application and compute its host-side SHA-256;
5. record the local Arduino CLI identity when available;
6. archive all raw INFO and SCHEMA lines alongside the campaign evidence.

A schema mismatch blocks the campaign before IDLE/LOAD/WIFI data collection. This prevents a user from selecting one campaign recipe while a different BetterBoard research firmware is actually responding on the serial port.

The embedded-source SHA-256 has a deliberately narrow meaning: it identifies the firmware source shipped inside this BetterBoard build. It is **not device attestation** and does not prove that the MCU flash bytes equal that source. Runtime INFO/SCHEMA evidence and host-side source identity are therefore stored as separate provenance layers rather than collapsed into one stronger claim.

Changing the selected recipe, FQBN, or serial device clears the in-memory provenance and campaign runs so evidence from different targets is not silently mixed.

Campaign runs preserve the raw serial response and the host timestamps returned by BetterBoard. The workspace can export three complementary artifacts directly from the completed in-memory campaign:

- **Archive JSON** — schema `betterboard.esp32-campaign/1`, runtime provenance, target/FQBN/port/baud, campaign plan, aggregates, ratios, run status, start/end timestamps, raw serial lines, and captured host timestamps.
- **Summary CSV** — one row per attempted campaign command with condition, status, primary metric, timestamps, error message, and raw-line count.
- **Comparator capture** — successful raw serial streams concatenated with comment delimiters plus provenance metadata so `scripts/esp32_condition_compare.py` and the existing analyzers can be rerun independently.

These exports are research evidence packages, not calibration certificates. Export is explicit and user initiated; BetterBoard does not silently upload campaign data anywhere.

The backend filters known operating-system debug/Bluetooth serial devices from board discovery and ranks likely USB hardware ports ahead of generic serial entries. Upload retries once after a short delay when the tool reports a resource-busy condition, then reports that an external serial monitor must be closed rather than pretending BetterBoard can close another application's handle.

Interactive research output is treated as a tagged research evidence stream, not canonical Measurement Evidence. Canonical numeric recipes continue to use the existing full CSV + metadata + Physical Lab compatibility package.

## Firmware review changes

The ESP32 research firmware was reviewed for failure behavior and protocol ambiguity. Important corrections include:

- explicit task-creation failure handling and bounded waits;
- no silent claim of multicore execution on single-core variants;
- explicit 64-bit timer output handling;
- Wi-Fi scan startup checked and failed closed;
- PSRAM experiments gated on actual PSRAM detection/allocation;
- explicit two-pi constants rather than depending on `M_PI` availability;
- irregular-dt acquisition keeps serial output out of the timing-critical acquisition loop;
- concurrency and irregular-dt data rows carry explicit `REDUCE` / `AFFINITY` / `JITTER` / `IRREG` row tags, so host analyzers do not infer row type from ambiguous numeric positions.

## Host analyzers

The stronger host analyzers remain separate scripts so reference calculations are independent of MCU arithmetic:

- `scripts/esp32_numerical_research_analyzer.py`
- `scripts/esp32_concurrency_numerics_analyzer.py`
- `scripts/esp32_irregular_dt_analyzer.py`
- `scripts/esp32_condition_compare.py`

`esp32_condition_compare.py` is the condition-aware aggregation layer. It only compares runs when experiment parameters match. For timing runs it can produce LOAD/IDLE and WIFI/IDLE RMS-lateness ratios and deadline-miss-rate changes. For irregular-dt experiments it groups on the same nominal period and signal frequency, then compares timing RMSE, derivative RMSE, integral RMSE and measured-dt gains across IDLE, LOAD and WIFI conditions. A run at a different period or frequency is deliberately not folded into the ratio.

The concurrency analyzer consumes explicit row tags and retains a conservative fallback for older untagged captures. The irregular-dt analyzer accepts both current tagged rows and older schema-v2 captures.

## Campaign planning, provenance, and export utilities

`src/esp32Campaign.ts` contains the campaign planner and first-pass aggregation helpers used by the BetterBoard campaign workspace. Campaign plans are bounded to 1–10 repeats. Numerical-suite plans generate matched `JITTER`, `LOADJITTER`, and `WIFIJITTER` commands; concurrency plans generate `JITTER` and `LOADJITTER`; irregular-dt plans generate `IRREG` IDLE/LOAD/WIFI commands with the same period, sample count, and signal frequency.

The planner rotates condition order on successive repeats, aggregates only finite observations, computes sample standard deviation, and refuses to emit a condition/IDLE ratio when the baseline is missing or zero. The live UI is therefore a campaign-control and first-pass statistics layer rather than a replacement for the archival Python comparator.

`src/esp32Provenance.ts` owns the campaign runtime-identity contract: expected schema prefixes, INFO parsing, INFO envelope checks, observed schema extraction, host-side SHA-256, and conservative rendering of chip/core/CPU/heap/PSRAM fields. It is intentionally tolerant of differences between the three existing firmware INFO payloads while requiring the core identity envelope and schema match.

`src/esp32CampaignExport.ts` defines the research archive contract and deterministic text exports. It preserves raw serial evidence instead of storing only the derived metric, emits CSV with proper quoting, includes the provenance object in archive JSON, and writes provenance comment lines into the comparator stream. The archive explicitly labels the firmware hash as host embedded-source identity rather than device attestation.

## Validation layers

Repository self-check validates 11 canonical recipes plus 4 ESP32 research recipes, the ESP32/S3/C3 board profiles, firmware/source registration, the Research and Campaign workspaces, campaign planning/provenance/export utilities, frontend-to-Rust command contracts and the legacy Physical Lab bridge invariants.

`scripts/esp32_analyzer_self_check.py` runs synthetic protocol fixtures through the numerical, concurrency, irregular-dt and condition-comparison paths. The condition comparison fixture specifically checks that same-parameter IDLE/LOAD/WIFI runs generate ratios while a mismatched period is excluded. These are offline software tests only and are not presented as hardware validation.

The GitHub Actions quality workflow runs repository self-check, ESP32 analyzer contract checks, frontend production build and Rust `cargo check` with the required Linux Tauri/serial dependencies. TypeScript compilation covers the campaign planner, provenance utility, Campaign workspace, and archive/export code in addition to the existing ESP32 Research workspace.

The following evidence is still required before any ESP32 research recipe is called canonical:

1. identify the user's exact ESP32 board/profile and confirm its FQBN;
2. install/verify the appropriate Arduino-ESP32 core in the actual BetterBoard environment;
3. compile each recipe against the exact target;
4. upload and verify `#READY`, `#SCHEMA`, `INFO` and representative commands;
5. confirm the campaign provenance gate on the real board and archive its observed INFO/SCHEMA payload;
6. capture repeat runs and process them through the matching host analyzer and condition comparator;
7. execute repeated matched-condition campaigns to estimate run-to-run variation;
8. archive raw captures, provenance, campaign metadata, summary outputs and environmental notes;
9. document chip model, revision where reported, core count, Arduino-ESP32 version when available, CPU frequency, PSRAM state and test environment;
10. only then consider promotion from research-stage to canonical.

## Scientific boundary

These experiments are designed to distinguish arithmetic precision, algorithmic stability, operation ordering, scheduling/timing irregularity, radio/background activity and memory/topology effects. They do not make universal performance claims about all ESP32 devices. MCU `sin`/`sinf` results are comparison implementations, not truth; high-precision or analytic host references remain the reference layer where applicable. IDLE is a runtime baseline rather than an externally calibrated truth source, and LOAD/WIFI ratios are only meaningful for parameter-matched runs on the tested board/build/environment. Runtime schema verification establishes protocol compatibility, not cryptographic firmware identity; the host source SHA-256 establishes BetterBoard-side source identity, not flashed-device attestation.
