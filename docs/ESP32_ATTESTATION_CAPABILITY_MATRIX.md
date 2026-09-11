# ESP32 hardware-attestation capability matrix

Status: **research design only; no eFuse provisioning or production attestation is performed by BetterBoard.**

BetterBoard now distinguishes three separate questions:

1. Does the silicon family document a hardware primitive that could support device identity?
2. Is the connected device actually provisioned and protected correctly?
3. Does BetterBoard have a nonce-based verifier protocol that proves possession of that protected key for this session?

Only the first question is answered by `scripts/esp32_attestation_capabilities.py`.

## Reviewed BetterBoard profiles

| BetterBoard FQBN | Secure Boot v2 | eFuse-backed HMAC | RSA Digital Signature peripheral | BetterBoard research classification |
| --- | --- | --- | --- | --- |
| `esp32:esp32:esp32s3` | supported | supported | supported | hardware-key-backed prototype candidate |
| `esp32:esp32:esp32c3` | supported | supported | supported | hardware-key-backed prototype candidate |
| `esp32:esp32:esp32` | revision-dependent on classic ESP32 | not claimed by generic profile | not claimed by generic profile | no hardware-key attestation claim |

The classic `esp32:esp32:esp32` profile intentionally stays conservative because the FQBN does not identify chip revision, and classic ESP32 Secure Boot v2 support is revision-dependent.

## Why S3/C3 are candidates

Espressif documents an HMAC peripheral on ESP32-S3 and ESP32-C3 that can use a secret key stored in eFuse. Espressif also documents the RSA Digital Signature peripheral on these families; its protected signing workflow is designed so sensitive key material does not need to become ordinary application-visible plaintext during signing.

That makes two different research paths possible:

- **HMAC challenge-response:** useful in a controlled laboratory where verifier and device can share a secret. It does not provide public verifiability and creates verifier-side secret-management requirements.
- **RSA-DS challenge signing:** preferable for a future BetterBoard attestation prototype because the verifier can hold only a public key. A fresh nonce can be signed by the device and verified by the host without sharing the private signing key with the host.

Neither path should be called attestation merely because the chip contains the peripheral. BetterBoard must additionally establish provisioning state, key protection, freshness, firmware trust, and verifier binding.

## Proposed BetterBoard Level 8 prototype

A future prototype should use a fresh host nonce and a structured statement such as:

```text
BetterBoard Attestation v1
nonce
build_id
source_sha256
schema
chip_model
security_state_digest
```

The device would sign a hash of that statement with a hardware-protected signing primitive where the exact chip/toolchain supports it. The host would verify the signature against a previously enrolled public key and reject reused nonces.

The signature should be treated as evidence of **key possession for this challenge**. Binding that key to a trustworthy device/firmware lifecycle requires separate enrollment and provisioning evidence.

## Secure Boot relationship

Secure Boot v2 is complementary rather than equivalent to remote attestation. It constrains which signed software may execute during boot. For a meaningful device-identity protocol, that matters because an attacker-controlled firmware should not be allowed to freely use a protected identity primitive. But Secure Boot by itself does not answer a remote verifier's nonce or prove freshness.

## Irreversible provisioning boundary

BetterBoard research code must not silently provision security eFuses, burn keys, disable debug/download interfaces, or enable irreversible production security state. Those operations are intentionally outside automatic BetterBoard workflows until an exact board, chip revision, recovery plan, and hardware-validation procedure are confirmed.

The current tool is therefore read-only/static classification:

```bash
python3 scripts/esp32_attestation_capabilities.py --fqbn esp32:esp32:esp32s3
```

It returns schema `betterboard.esp32-attestation-capability/1` and fails conservative for unknown profiles.

## Evidence boundary

A capability result means only that BetterBoard has reviewed a documented silicon feature for that target profile. It does not prove:

- an eFuse key exists on the connected board;
- the key is read/write protected correctly;
- Secure Boot or Flash Encryption is enabled;
- the running firmware is trustworthy;
- the host has an enrolled public identity for this device;
- a challenge-response exchange is fresh or resistant to replay;
- a production certificate chain exists.

Until those gates are implemented and tested on real hardware, BetterBoard should describe S3/C3 as **hardware-key-backed attestation prototype candidates**, not attested devices.
