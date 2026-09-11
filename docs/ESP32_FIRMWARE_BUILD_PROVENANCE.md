# ESP32 firmware build provenance

Status: **research-stage build provenance with firmware self-reported build identity and optional independent flash readback; not hardware-rooted cryptographic attestation**.

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

## Independent flash readback

For Arduino-ESP32 builds that emit `build/flasher_args.json`, BetterBoard now also provides an independent host-side readback verifier:

```bash
python3 scripts/esp32_verify_flash.py \
  --manifest out/esp32-build/firmware_build_manifest.json \
  --port /dev/cu.usbmodemXXXX
```

The verifier does not ask the running firmware to identify itself. It reads the flash layout from the local Arduino-ESP32 `flasher_args.json`, resolves each referenced build image, uses `esptool` to read back exactly the same byte count from each recorded flash offset, computes SHA-256 on the readback, and compares it to the corresponding local image.

The output schema is `betterboard.esp32-flash-verification/1`. It contains every verified offset, byte count, expected hash, observed hash, read command, and per-region match result. Any mismatch exits non-zero.

The verifier deliberately fails closed when `flasher_args.json` is missing, the uploader layout is unsupported, or a referenced build image cannot be resolved. It does not guess ESP32 partition/application offsets from board names. This matters because classic ESP32, S3, C3, partition schemes, and core versions can use different layouts.

Flash encryption, secure-boot configuration, read protection, or target-specific upload transformations can make byte-for-byte readback unavailable or inappropriate. In those cases the failure is evidence that this method cannot establish identity for that target; it is not permission to weaken the comparison.

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
        ↓
independent esptool flash readback using recorded flash offsets
        ↓
per-region flash SHA-256 comparison
```

## Evidence boundary

A build artifact digest answers **“what did this local compile produce?”** The optional upload record answers **“which recorded build directory did BetterBoard ask Arduino CLI to upload to this port?”** A matching runtime build id strengthens the operational association to **“the running firmware reports the identity assigned to this build.”** A complete independent flash-readback match is stronger still because it compares host-read flash bytes against the actual build images without relying on firmware self-report.

This is still not the same thing as a hardware-rooted signed attestation. A host with control of the programming interface can replace firmware, secure-boot/read-protection policies can change what is readable, and this verifier does not establish a protected device key or certificate chain. BetterBoard therefore describes it as **independent flash verification**, not cryptographic device attestation.

The Campaign provenance gate remains complementary:

1. the local build manifest identifies source/toolchain/FQBN and compiled artifacts;
2. the optional upload record associates that exact build directory with a serial target;
3. runtime `INFO` identifies the connected chip/runtime and can expose the stamped build id;
4. runtime `SCHEMA` verifies that the running firmware protocol family matches the selected recipe;
5. the build-id verifier checks manifest/self-report association;
6. the flash verifier independently compares recorded flash regions against the exact local build images when the target/toolchain layout supports it.

## Validation

`scripts/esp32_build_manifest_self_check.py` uses a fake Arduino CLI and fake esptool in CI. It verifies that the temporary compile source is actually stamped, the generated header reaches the compile sketch, artifact hashes are recorded, upload is invoked against the same build directory when a port is supplied, a matching device capture passes the build-id verifier, and a mismatching capture fails.

The same self-check now creates a synthetic `flasher_args.json` with bootloader, partition-table, and application regions. It verifies that independent readback succeeds when all three flash regions match and exits non-zero when the application-region readback is intentionally corrupted.

Before canonical promotion, the complete chain must still be exercised with the user's exact ESP32 FQBN, real Arduino-ESP32 toolchain, real `flasher_args.json`, actual upload, `INFO` capture, and actual flash readback on hardware that permits it.
