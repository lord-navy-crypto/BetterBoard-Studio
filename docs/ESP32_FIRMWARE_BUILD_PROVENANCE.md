# ESP32 firmware build provenance

Status: **research-stage build provenance; not device attestation**.

BetterBoard now includes `scripts/esp32_build_manifest.py` to turn a reviewed embedded firmware source into a reproducible local build evidence package.

Example:

```bash
python3 scripts/esp32_build_manifest.py \
  --recipe esp32_numerical_suite \
  --fqbn esp32:esp32:esp32 \
  --out-dir out/esp32-build
```

The tool copies the selected BetterBoard firmware source into an isolated temporary sketch directory, invokes `arduino-cli compile` with the exact FQBN and a controlled build path, then writes `firmware_build_manifest.json` next to the build outputs.

The manifest uses schema `betterboard.firmware-build/1` and records:

- BetterBoard recipe id/title/sketch name;
- exact FQBN and derived Arduino core id;
- detected installed core version when available;
- Arduino CLI path/version and compile command;
- repository source path, source size, and source SHA-256;
- compiled `.bin`, `.elf`, `.hex`, and `.map` artifacts when emitted, including byte size and SHA-256;
- compile output for audit/debugging.

## Evidence boundary

A build artifact digest answers **“what did this local compile produce?”** It does not answer **“what binary is currently flashed on the connected ESP32?”**

Therefore BetterBoard must not call the build manifest a device attestation. A later upload/run can be associated with the manifest operationally, but cryptographic proof of flash identity requires a device-side build identifier, firmware-reported digest, signed manifest, or another independently verifiable mechanism.

The existing Campaign provenance gate remains complementary:

1. local build manifest identifies the source/toolchain/FQBN and build artifacts;
2. runtime `INFO` identifies the connected chip/runtime properties;
3. runtime `SCHEMA` verifies that the running firmware protocol family matches the selected recipe;
4. neither step alone proves binary identity on flash.

## Promotion plan

Before this becomes canonical BetterBoard build provenance, validate the tool on the user's exact ESP32 FQBN and Arduino-ESP32 installation, confirm the artifact set produced by that core version, and connect the resulting manifest to Studio compile/upload UX without weakening the attestation boundary.
