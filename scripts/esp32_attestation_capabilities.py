#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json


CAPABILITIES = {
    "esp32:esp32:esp32s3": {
        "family": "ESP32-S3",
        "secure_boot_v2": "supported",
        "hmac_efuse_key": "supported",
        "rsa_ds": "supported",
        "challenge_response_candidate": True,
        "public_key_attestation_candidate": True,
        "notes": [
            "ESP32-S3 exposes an HMAC peripheral backed by eFuse keys.",
            "ESP32-S3 exposes the RSA Digital Signature peripheral; private RSA material can remain inaccessible to software during signing.",
            "Secure Boot v2 can bind execution to authorized firmware, but it is not itself remote attestation.",
        ],
    },
    "esp32:esp32:esp32c3": {
        "family": "ESP32-C3",
        "secure_boot_v2": "supported",
        "hmac_efuse_key": "supported",
        "rsa_ds": "supported",
        "challenge_response_candidate": True,
        "public_key_attestation_candidate": True,
        "notes": [
            "ESP32-C3 exposes an HMAC peripheral backed by eFuse keys.",
            "ESP32-C3 exposes the RSA Digital Signature peripheral for protected device identity use cases.",
            "Secure Boot v2 can strengthen the trust boundary around the attestation firmware but does not replace a verifier protocol.",
        ],
    },
    "esp32:esp32:esp32": {
        "family": "ESP32",
        "secure_boot_v2": "revision-dependent (chip revision v3.0/ECO3 and later)",
        "hmac_efuse_key": "not claimed by BetterBoard generic profile",
        "rsa_ds": "not claimed by BetterBoard generic profile",
        "challenge_response_candidate": False,
        "public_key_attestation_candidate": False,
        "notes": [
            "The generic classic ESP32 profile does not encode chip revision.",
            "Secure Boot v2 support on classic ESP32 is revision-dependent.",
            "BetterBoard deliberately does not infer HMAC/RSA-DS attestation capability from a generic classic ESP32 FQBN.",
        ],
    },
}


def classify(fqbn: str) -> dict:
    base = CAPABILITIES.get(fqbn)
    if base is None:
        return {
            "schema": "betterboard.esp32-attestation-capability/1",
            "fqbn": fqbn,
            "family": "unknown",
            "known_profile": False,
            "prototype_attestation_level": "unsupported-until-characterized",
            "reason": "No reviewed BetterBoard capability profile exists for this FQBN.",
            "boundary": "Capability classification is not proof that security eFuses are provisioned, protected, or active on a connected device.",
        }

    if base["public_key_attestation_candidate"]:
        level = "hardware-key-backed-prototype-candidate"
    elif base["challenge_response_candidate"]:
        level = "shared-secret-prototype-candidate"
    else:
        level = "no-hardware-key-attestation-claim"

    return {
        "schema": "betterboard.esp32-attestation-capability/1",
        "fqbn": fqbn,
        "known_profile": True,
        "prototype_attestation_level": level,
        **base,
        "recommended_research_path": (
            "Prefer a nonce-based verifier protocol. For S3/C3, evaluate RSA-DS for asymmetric verification and HMAC for controlled laboratory challenge-response. "
            "Bind any prototype to measured security state and firmware/build identity; never treat profile support as proof of provisioning."
            if base["public_key_attestation_candidate"]
            else "Keep using build identity plus independent flash verification. Do not claim hardware-rooted attestation from this generic profile."
        ),
        "boundary": (
            "This matrix describes documented silicon capabilities for a BetterBoard target profile. It does not prove that a particular board has keys provisioned, "
            "that eFuses are correctly protected, that Secure Boot is enabled, or that an attestation protocol is secure. Irreversible provisioning remains a separate, explicit hardware-validation step."
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Classify BetterBoard ESP32 hardware-attestation research capabilities without modifying a device.")
    ap.add_argument("--fqbn", required=True)
    args = ap.parse_args()
    print(json.dumps(classify(args.fqbn), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
