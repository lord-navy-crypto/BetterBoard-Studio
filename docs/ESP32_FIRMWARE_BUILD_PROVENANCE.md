# ESP32 firmware build provenance

Status: **research-stage build provenance with firmware self-reported build identity; not cryptographic device attestation**.

BetterBoard includes `scripts/esp32_build_manifest.py` to turn a reviewed embedded firmware source into a reproducible local build evidence package and to stamp the temporary compile copy with a deterministic build identity.

Example compile-only run:

```bash
python3 scripts/esp32_build_manifest.py \
  --recipe esp32_numerical_suite \
  --fqbn esp32:esp32:esp32 \
  --out-dir out/esp32-build
```

The same tool can associate an upload with the exact compiled build directory by adding a port:

```bash
python3 scripts/esp32_build_manifest.py \
  --recipe esp32_numerical_suite \
  --fqbn esp32:esp32:esp32 \
  --out-dir out/esp32-build \
  --port /dev/cu.usbmodemXXXX
```

When `--port` is supplied, BetterBoard invokes `arduino-cli upload` with `--input-dir` pointing at the exact build directory whose artifacts and hashes are recorded in the manifest. The upload record stores the port, exact command, completion time, success/failure status, and CLI output. This creates an operational build→upload association without claiming independent proof of flash contents.

The tool reads the selected BetterBoard firmware source, derives a deterministic build identity from recipe id, exact FQBN, Arduino core/version, Arduino CLI version, and repository source SHA-256, then creates an isolated temporary compile copy. The repository source is not modified.

The temporary compile copy receives `BetterBoardBuildProvenance.h` and three additional INFO fields:

- `#BUILD_ID,<id>`
- `#SOURCE_SHA256,<sha256>`
- `#BUILD_IDENTITY_SHA256,<sha256>`

The stamped source is archived as `betterboard_stamped_source.ino`, so the exact source sent into the compiler can be audited independently of the repository source.

The manifest uses schema `betterboard.firmware-build/2` and records:

- BetterBoard recipe id/title/sketch name;
- exact FQBN and derived Arduino core id;
- detected installed core version when available;
- Arduino CLI path/version and compile command;
- repository source path, source size, and source SHA-256;
- stamped compile-source path and SHA-256;
- deterministic BetterBoard build id plus the full identity SHA-256 and derivation payload;
- compiled `.bin`, `.elf`, `.hex`, and `.map` artifacts when emitted, including byte size and SHA-256;
- optional exact-build upload record;
- compile/upload output for audit/debugging.

The build id is currently `bb-` plus the first 20 hex characters of the SHA-256 of a canonical identity payload. It is an association identifier, not a secret, signature, or security credential.

## Device-match check

After a stamped firmware build is uploaded and its `INFO` output is captured, the host can compare the device-reported build id with the manifest:

```bash
python3 scripts/esp32_verify_build_identity.py \
  --manifest out/esp32-build/firmware_build_manifest.json \
  --capture captured-info.txt
```

The verifier emits schema `betterboard.device-build-match/1` and exits successfully only when `#BUILD_ID` matches the manifest build id. A mismatch exits non-zero so it can be used as a promotion/validation gate.

This creates the following evidence chain:

```text
reviewed repository source
        ↓
source SHA-256 + exact FQBN/toolchain identity
        ↓
deterministic BetterBoard BUILD_ID
        ↓
stamped compile source + generated provenance header
        ↓
local binary / ELF SHA-256
        ↓
arduino-cli upload using that exact build directory
        ↓
device INFO self-reports BUILD_ID
        ↓
host manifest/device BUILD_ID comparison
```

## Evidence boundary

A build artifact digest answers **“what did this local compile produce?”** The optional upload record answers **“which recorded build directory did BetterBoard ask Arduino CLI to upload to this port?”** A matching runtime build id strengthens the operational association to **“the running firmware reports the identity assigned to this build.”**

Those facts still do not prove flash contents cryptographically. Firmware can self-report arbitrary text, the upload tool can fail in target-specific ways, and the current verifier does not independently read or hash ESP32 flash. BetterBoard therefore must not call this device attestation.

Stronger future levels could include independently reading the flashed application image, comparing a flash digest to the manifest binary digest, secure-boot-backed measurements, or signed attestation where the target hardware actually supports and protects the necessary key material.

The Campaign provenance gate remains complementary:

1. the local build manifest identifies source/toolchain/FQBN and compiled artifacts;
2. the optional upload record associates that exact build directory with a serial target;
3. runtime `INFO` identifies the connected chip/runtime and can expose the stamped build id;
4. runtime `SCHEMA` verifies that the running firmware protocol family matches the selected recipe;
5. the build-id verifier checks manifest/self-report association;
6. none of those steps alone is an independent cryptographic flash measurement.

## Validation

`scripts/esp32_build_manifest_self_check.py` uses a fake Arduino CLI in CI. It verifies that the temporary compile source is actually stamped, the generated header reaches the compile sketch, artifact hashes are recorded, upload is invoked against the same build directory when a port is supplied, a matching device capture passes the build-id verifier, and a mismatching capture fails.

Before canonical promotion, the same chain must be exercised with the user's exact ESP32 FQBN and real Arduino-ESP32 toolchain, then repeated after real upload and `INFO` capture.
