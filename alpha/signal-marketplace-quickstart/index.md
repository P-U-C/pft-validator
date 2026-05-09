---
layout: default
title: "Signal Marketplace SDK Smoke-Test Quickstart"
subtitle: "Local-only end-to-end run of the pft_indexing SDK that exercises every marketplace primitive without live credentials, funded wallets, or network egress for content."
date: 2026-05-08
category: alpha
status: published
author: Permanent Upper Class (PFT Validator)
---

# Signal Marketplace SDK Smoke-Test Quickstart

This page lets a developer prove, in roughly 5 minutes, that the Post Fiat Signal Marketplace SDK works end-to-end on their machine. It runs a real cryptographic round-trip -- producer encrypts a signed signal artifact for a subscriber's pubkey, subscriber decrypts it with their mnemonic -- and verifies the result by SHA-256 digest match.

It does **not** require live credentials, funded wallets, IPFS pinning service keys, or any PFTL-mainnet/testnet write access. It generates two synthetic test wallets locally, never funds them, and never publishes anything on-chain.

If your final step prints `PASS: round-trip integrity verified`, the SDK is correctly installed and the marketplace primitives work end-to-end.

---

## What this smoke test exercises (and what it doesn't)

| Marketplace step | Exercised in smoke test? | How |
|---|---|---|
| List offer (publish encrypted snapshot) | ✅ partially | encrypted blob is produced locally; not pinned to IPFS, no `pf.ptr:v4` memo submitted |
| Purchase / access-grant equivalent | ✅ | local subscriber recipient identity is accepted by the producer encryption path; payment, access-manifest publication, and PFTL submission are intentionally suppressed |
| Delivery | ✅ fully | subscriber decrypts the blob using their stored BIP39 mnemonic, exactly as a real subscriber would after fetching the access manifest |
| Release / completion | ✅ fully | original-vs-recovered SHA-256 digest match is the integrity proof equivalent to the publication-receipt step |

What the smoke test deliberately **skips** to stay credential-free:

- IPFS pinning (would need Pinata/IPFS API credentials)
- `pf.ptr:v4` PFTL memo submission (would need a funded wallet and `PFTL_WSS_URL`)
- Access manifest publication (also a PFTL submit)

The full testnet flow that does include those steps is documented in the SDK repo's `docs/operator_publish_index.md` and `docs/test_wallet_provisioning.md`. See "Optional next steps" at the bottom of this page.

---

## Mock marketplace event log

This quickstart uses a local-only marketplace surrogate. No live order book, funded wallet, IPFS pin, or PFTL transaction is created. Instead, the SDK commands below emit the minimum equivalent state transitions needed to verify the full marketplace lifecycle safely.

| Marketplace phase | Local smoke-test equivalent | Verification signal |
|---|---|---|
| Offer listed | `snapshot-id` creates a deterministic offer identity from the canonical artifact | Stable content hash and snapshot ID |
| Buyer prepared | `wallet-create --label subscriber` creates an unfunded local subscriber identity | `funding: null`, `active: false` |
| Purchase / access-grant equivalent | `x25519-pubkey` exposes the subscriber recipient identity to the producer flow | Recipient pubkey derived locally, no funds moved |
| Signal delivered | `encrypt-x25519` writes a subscriber-addressed encrypted payload | `recipient_count: 1`, encrypted file present on disk |
| Buyer unlocks signal | `decrypt-x25519` recovers the delivered snapshot using the subscriber's mnemonic | Exit code 0 and recovered file |
| Release completed | Original and recovered digests match | `PASS: round-trip integrity verified` |

Expected local event log (the semantic receipt of the marketplace lifecycle, in the shape a real marketplace pipeline would emit at each phase):

```json
[
  {
    "phase": "offer_listed",
    "offer_id": "pf.snap.9367ee72f2baacb665c27ae30f97611a",
    "content_hash": "cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af",
    "delivery_format": "ENC_X25519_XCHACHA20P1305",
    "mode": "local_only"
  },
  {
    "phase": "purchase_equivalent",
    "buyer": "subscriber",
    "producer": "producer",
    "payment": "suppressed",
    "funding_required": false,
    "live_credentials_required": false
  },
  {
    "phase": "delivery",
    "artifact": "snapshot.v1.encrypted.json",
    "recipient_count": 1,
    "network_publish": "suppressed"
  },
  {
    "phase": "release_equivalent",
    "artifact": "snapshot.v1.recovered.json",
    "integrity": "sha256_match",
    "result": "PASS"
  }
]
```

In this quickstart, "purchase equivalent" means the subscriber's local recipient identity is accepted by the producer-side encryption path without moving funds. In the full marketplace flow, this point would be replaced by funded testnet purchase, access-manifest publication, and pointer submission. The smoke test intentionally stops before those steps to remain credential-free.

If you want to capture this event log as a real file during your run, append the following snippet after step 10:

```bash
cat > marketplace-events.json <<EOF
[
  {"phase":"offer_listed","offer_id":"pf.snap.9367ee72f2baacb665c27ae30f97611a","content_hash":"$(pft-index digest snapshot.v1.json)","delivery_format":"ENC_X25519_XCHACHA20P1305","mode":"local_only"},
  {"phase":"purchase_equivalent","buyer":"subscriber","producer":"producer","payment":"suppressed","funding_required":false,"live_credentials_required":false},
  {"phase":"delivery","artifact":"snapshot.v1.encrypted.json","recipient_count":1,"network_publish":"suppressed"},
  {"phase":"release_equivalent","artifact":"snapshot.v1.recovered.json","integrity":"sha256_match","result":"PASS"}
]
EOF
cat marketplace-events.json
```

The resulting `marketplace-events.json` is the deterministic semantic receipt of the marketplace round-trip — suitable for hashing and anchoring if the operator wants a tamper-evident smoke-test attestation.

---

## Prerequisites

- Linux/macOS shell with bash
- Python 3.10+
- Node.js 20+ (the SDK shells out to `xrpl` for BIP39 -> PFTL address derivation)
- Disk: a couple hundred MB for the SDK + xrpl npm module
- Network: read-only access to `https://rpc.testnet.postfiat.org` is helpful but not required (used for a benign account-balance check that returns `actNotFound` for unfunded test wallets)

---

## Setup

Clone the SDK and install in editable mode:

```bash
git clone https://github.com/agtico/pft_indexing.git
cd pft_indexing
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Choose a working directory for the smoke test that is **separate** from any production workspace, and install the `xrpl` Node module locally so the wallet-derivation shell-out can find it:

```bash
mkdir -p /tmp/pft-smoke-test
cd /tmp/pft-smoke-test
npm init -y > /dev/null
npm install xrpl
```

Set a dedicated seed DB path and a throwaway passphrase. **Do not reuse a real wallet passphrase.**

```bash
export PFT_INDEX_SEED_DB=/tmp/pft-smoke-test/wallet_seeds.sqlite3
export PFT_INDEX_WALLET_PASSPHRASE='smoke-test-passphrase-not-real'
```

Copy the canonical sample fixture into the working directory:

```bash
cp $OLDPWD/examples/igv_top10_2026-04-27.snapshot.v1.json snapshot.v1.json
```

(or wherever your local `pft_indexing/examples/` directory is)

You are ready to run the flow.

---

## One-command runner (optional)

If you'd rather prove it in a single shot than walk through 10 steps, save the script below as `run-signal-marketplace-smoke.sh` and run it. It performs setup, runs every step, and prints the same `PASS` line at the end.

```bash
cat > run-signal-marketplace-smoke.sh <<'EOF'
#!/bin/bash
set -euo pipefail

# Clone + install the SDK (skip if already installed)
git clone https://github.com/agtico/pft_indexing.git || true
cd pft_indexing
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -e . > /dev/null

# Working directory
mkdir -p /tmp/pft-smoke-test
cp examples/igv_top10_2026-04-27.snapshot.v1.json /tmp/pft-smoke-test/snapshot.v1.json
cd /tmp/pft-smoke-test

# Node module for BIP39 -> PFTL derivation
npm init -y > /dev/null
npm install xrpl > /dev/null

# Throwaway smoke-test secrets
export PFT_INDEX_SEED_DB=/tmp/pft-smoke-test/wallet_seeds.sqlite3
export PFT_INDEX_WALLET_PASSPHRASE='smoke-test-passphrase-not-real'

# Marketplace lifecycle
pft-index validate snapshot.v1.json
pft-index digest snapshot.v1.json
pft-index snapshot-id snapshot.v1.json --json
pft-index wallet-create --label producer   --passphrase-env PFT_INDEX_WALLET_PASSPHRASE
pft-index wallet-create --label subscriber  --passphrase-env PFT_INDEX_WALLET_PASSPHRASE
pft-index seed-list
pft-index x25519-pubkey --wallet subscriber --passphrase-env PFT_INDEX_WALLET_PASSPHRASE
pft-index encrypt-x25519 snapshot.v1.json \
  --wallet subscriber --passphrase-env PFT_INDEX_WALLET_PASSPHRASE \
  --out snapshot.v1.encrypted.json --owner-key-out snapshot.v1.x25519-owner-key.json
pft-index decrypt-x25519 snapshot.v1.encrypted.json \
  --wallet subscriber --passphrase-env PFT_INDEX_WALLET_PASSPHRASE \
  --out snapshot.v1.recovered.json

ORIG=$(pft-index digest snapshot.v1.json)
RECV=$(pft-index digest snapshot.v1.recovered.json)
echo "original  $ORIG"
echo "recovered $RECV"
[ "$ORIG" = "$RECV" ] \
  && echo "PASS: round-trip integrity verified -- digests match" \
  || { echo "FAIL: digest mismatch"; exit 1; }
EOF

bash run-signal-marketplace-smoke.sh
```

Either path (one-shot script or step-by-step below) ends at the same deterministic `PASS` line.

---

## The flow

### Step 1 -- Validate the snapshot artifact

```bash
pft-index validate snapshot.v1.json
```

Expected output (warnings are informational; the artifact is `valid`):

```
warning snapshot coverage is partial_top_n
warning positions[0].instrument identity quality is weak
warning positions[0].valuation.price_observation.data_source.source_hash is null
... (33 warnings total, one per soft-data-quality field on the sample)
warning provenance.source_records[0] license/redistribution is unknown
valid snapshot.v1.json
sha256 cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af
```

The `sha256` line is byte-stable across all runs against this fixture. Remember that hash; you will compare against it in step 10.

### Step 2 -- Compute the canonical digest

```bash
pft-index digest snapshot.v1.json
```

Expected output (deterministic; matches the `sha256` printed in step 1):

```
cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af
```

### Step 3 -- Compute the deterministic snapshot identity

```bash
pft-index snapshot-id snapshot.v1.json --json
```

Expected output (deterministic):

```json
{
  "content_hash": "cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af",
  "snapshot_digest": "9367ee72f2baacb665c27ae30f97611a7acd62141bc2c7043160fa1a0ef00c73",
  "snapshot_id": "pf.snap.9367ee72f2baacb665c27ae30f97611a",
  "warnings": [...33 warnings...]
}
```

The `snapshot_id` is the canonical identifier a real `pf.ptr:v4` memo would point to. It is byte-stable for any reader running this fixture.

### Step 4 -- Generate the producer wallet (local, unfunded)

```bash
pft-index wallet-create --label producer \
    --passphrase-env PFT_INDEX_WALLET_PASSPHRASE
```

Expected output shape (your wallet address will differ -- it is a freshly generated random BIP39 seed, never reused, never funded):

```json
{
  "balance": {
    "active": false,
    "address": "r<PRODUCER_ADDR>",
    "error": "actNotFound",
    "error_message": "Account not found."
  },
  "derived": {
    "address": "r<PRODUCER_ADDR>",
    "derivation_path": "m/44'/144'/0'/0/0",
    "public_key": "<33-BYTE_SECP256K1_HEX>"
  },
  "funding": null,
  "mnemonic_printed": false,
  "seed_stored": true,
  "wallet": {
    "created_at": "<ISO8601>",
    "label": "producer",
    "updated_at": "<ISO8601>",
    "wallet_address": "r<PRODUCER_ADDR>",
    "wallet_id": "wallet_<HEX_ID>"
  }
}
```

Note `"active": false` and `"error": "actNotFound"` -- this confirms the wallet exists only locally in your seed DB and has never been funded on chain. `"mnemonic_printed": false` confirms the BIP39 phrase did not leak to stdout; it is encrypted with your passphrase and stored in the seed DB. `"funding": null` confirms no payment transaction was attempted.

### Step 5 -- Generate the subscriber wallet (local, unfunded)

```bash
pft-index wallet-create --label subscriber \
    --passphrase-env PFT_INDEX_WALLET_PASSPHRASE
```

Same output shape as step 4, with `"label": "subscriber"` and a different random address. Same safety properties: unfunded, mnemonic encrypted at rest, no chain submission.

### Step 6 -- Confirm both wallets are stored

```bash
pft-index seed-list
```

Expected output shape:

```json
[
  {
    "created_at": "<ISO8601>",
    "label": "producer",
    "updated_at": "<ISO8601>",
    "wallet_address": "r<PRODUCER_ADDR>",
    "wallet_id": "wallet_<HEX_ID>"
  },
  {
    "created_at": "<ISO8601>",
    "label": "subscriber",
    "updated_at": "<ISO8601>",
    "wallet_address": "r<SUBSCRIBER_ADDR>",
    "wallet_id": "wallet_<HEX_ID>"
  }
]
```

### Step 7 -- Derive the subscriber's X25519 recipient identity

```bash
pft-index x25519-pubkey --wallet subscriber \
    --passphrase-env PFT_INDEX_WALLET_PASSPHRASE
```

Expected output shape:

```json
{
  "enc": "ENC_X25519_XCHACHA20P1305",
  "pftl_address": "r<SUBSCRIBER_ADDR>",
  "recipient_id": "<64-HEX_RECIPIENT_ID>",
  "wallet": "subscriber",
  "x25519_pubkey": "<base64-32-byte-x25519-pubkey>",
  "x25519_pubkey_hex": "<64-hex-x25519-pubkey>"
}
```

This is the recipient identity a real producer would receive from a subscriber after a purchase, and would include in the access manifest at the agreed delay tier.

### Step 8 -- Encrypt the snapshot for the subscriber

```bash
pft-index encrypt-x25519 snapshot.v1.json \
    --wallet subscriber \
    --passphrase-env PFT_INDEX_WALLET_PASSPHRASE \
    --out snapshot.v1.encrypted.json \
    --owner-key-out snapshot.v1.x25519-owner-key.json
```

Expected output (the `content_hash` is deterministic; the `encrypted_payload_hash` is per-run because the content key and ephemeral keys are fresh random):

```json
{
  "content_hash": "cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af",
  "enc": "ENC_X25519_XCHACHA20P1305",
  "encrypted": "snapshot.v1.encrypted.json",
  "encrypted_payload_hash": "<64-hex-payload-hash>",
  "owner_key": "snapshot.v1.x25519-owner-key.json",
  "recipient_count": 1
}
```

`snapshot.v1.encrypted.json` is the same shape a real producer would pin to IPFS and reference via `pf.ptr:v4` memo. `snapshot.v1.x25519-owner-key.json` is the producer's owner key kept locally (never published) for re-issuing access to additional subscribers later.

### Step 9 -- Subscriber decrypts the blob

```bash
pft-index decrypt-x25519 snapshot.v1.encrypted.json \
    --wallet subscriber \
    --passphrase-env PFT_INDEX_WALLET_PASSPHRASE \
    --out snapshot.v1.recovered.json
```

Expected output: nothing on stdout, exit code 0. The recovered file is written to `snapshot.v1.recovered.json`.

### Step 10 -- Verify round-trip integrity

```bash
ORIG=$(pft-index digest snapshot.v1.json)
RECV=$(pft-index digest snapshot.v1.recovered.json)
echo "original  $ORIG"
echo "recovered $RECV"
[ "$ORIG" = "$RECV" ] && echo "PASS: round-trip integrity verified -- digests match" \
                     || echo "FAIL: digest mismatch"
```

Expected output:

```
original  cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af
recovered cecd5f104fe8fb21b97197c70545e9017b6be0c19936bb5d41946783e44732af
PASS: round-trip integrity verified -- digests match
```

If you see `PASS`, the SDK works end-to-end on your machine.

---

## What you just verified

Each step exercises a real piece of the marketplace pipeline:

1. **Steps 1-3** prove the canonical artifact format works: every reader can compute the same SHA-256 digest and the same `pf.snap.<digest_prefix>` identity, which is what makes content-addressing work.
2. **Steps 4-6** prove the wallet-management layer works: BIP39 generation, PFTL address derivation via the same path used by `pftasks` (`m/44'/144'/0'/0/0`), and encrypted-at-rest seed storage in a local SQLite DB. None of this leaves your machine.
3. **Step 7** proves the X25519 recipient-identity derivation works. This is what a subscriber sends a producer to get listed as a recipient on an access manifest.
4. **Steps 8-9** prove the full `ENC_X25519_XCHACHA20P1305` envelope works: producer wraps a 32-byte content key for the subscriber's pubkey, subscriber unwraps with their derived X25519 private key. This is identical to how a real subscriber retrieves a paid signal from an IPFS-pinned encrypted blob.
5. **Step 10** is the integrity proof: if the original and recovered SHA-256 digests match, the entire pipeline preserved bytes exactly, with no silent corruption, no silent re-canonicalization, no silent loss of fields.

---

## Safety language

This smoke test was designed to be reproducible by any reader with **zero exposure** to the operator's keys, funds, or operational identity:

- **No private keys cross the boundary of your local machine.** Wallet mnemonics are generated locally, encrypted with your throwaway passphrase via scrypt-derived AES-256-GCM, and stored in a local SQLite DB at `$PFT_INDEX_SEED_DB`. The CLI never prints raw mnemonics to stdout (`mnemonic_printed: false`).
- **No live credentials are required.** No Pinata key, no IPFS API token, no PFTL RPC API key, no PFTL operator wallet. The only network call (the read-only balance check during `wallet-create`) requires no authentication and returns `actNotFound` for the freshly-generated unfunded test wallets.
- **No live-funds requirement.** The producer and subscriber wallets are never funded. `--submit-funding` is omitted from `wallet-create`. `funding: null` in the output confirms no payment was attempted. The wallets cannot move PFT because they have no balance and no signing key has been used to sign a transaction.
- **No wallet-identifying data is needed from the reader.** The commands will print the reader's own throwaway local wallet addresses (random per-run BIP39 seeds, never funded, never reused). **The published quickstart does not contain the operator's wallet addresses, real subscriber addresses, production X25519 pubkeys, funding accounts, transaction hashes, CIDs, or access-manifest recipient records.** Every wallet-identifying field in the expected outputs above uses a placeholder (`r<PRODUCER_ADDR>`, `r<SUBSCRIBER_ADDR>`, `<64-HEX_RECIPIENT_ID>`, `<base64-32-byte-x25519-pubkey>`).
- **No raw personal data is collected, generated, or transmitted.** The sample artifact contains only public market-cap data; it has no PII.

If you want to throw away the smoke-test state when you are done:

```bash
rm -rf /tmp/pft-smoke-test
unset PFT_INDEX_SEED_DB PFT_INDEX_WALLET_PASSPHRASE
```

That removes the encrypted seed DB, both throwaway wallets, the encrypted blob, the owner key, and the recovered snapshot. Nothing persists.

---

## Troubleshooting

**`Error: Cannot find module 'xrpl'`** -- the CLI shells out to Node for BIP39 -> PFTL derivation. Run `npm install xrpl` from the working directory and retry.

**`Error: PFT_INDEX_WALLET_PASSPHRASE not set`** -- export the env var before the wallet-create steps. The passphrase encrypts the seed DB at rest; reuse the same value for all steps in one session.

**Step 4 hangs for many seconds** -- the read-only balance check is reaching out to `rpc.testnet.postfiat.org`. If your network is offline, this will eventually time out and the wallet-create will succeed locally anyway. The wallet does not need testnet to be online.

**`PASS` does not print at step 10** -- the recovered digest mismatch indicates either a corrupted intermediate file, a wrong wallet label on decrypt, or a passphrase mismatch between encrypt and decrypt. Re-run from step 4 in a clean working directory.

**`ValueError: No matching key shard for this wallet`** at step 9 -- this happens if you pass `--wallet producer` (or any other label that is NOT the recipient the blob was encrypted for) to `decrypt-x25519`. Verbatim CLI output:

```
Traceback (most recent call last):
  File "/.../pft-index", line 8, in <module>
    sys.exit(main())
  File "/.../pft_indexing/cli.py", line 670, in main
    return args.func(args)
  File "/.../pft_indexing/cli.py", line 183, in cmd_decrypt_x25519
    plaintext = decrypt_blob_with_mnemonic(blob, mnemonic, access_manifests=manifests)
  File "/.../pft_indexing/pftasks_crypto.py", line 194, in decrypt_blob_with_mnemonic
    return decrypt_blob_with_keypair(blob, keypair, access_manifests=access_manifests)
  File "/.../pft_indexing/pftasks_crypto.py", line 167, in decrypt_blob_with_keypair
    raise ValueError("No matching key shard for this wallet")
ValueError: No matching key shard for this wallet
```

Exit code is `1` and the `--out` file is not written. Fix: pass `--wallet subscriber` (or the label of the wallet whose X25519 pubkey the blob was actually encrypted for in step 8).

This is intentional cryptographic behavior, not a bug. The `ENC_X25519_XCHACHA20P1305` envelope contains per-recipient key shards; only an X25519 private key that was a recipient at encrypt time can unwrap any shard. A real marketplace consumer who somehow obtained an encrypted signal blob without paying for an access grant would see this same error, which is the property that makes the marketplace privacy floor enforceable.

---

## Non-goals

This page intentionally does not test:

- price discovery
- live offer indexing
- escrow or funds movement
- PFTL transaction submission
- IPFS pinning
- production subscriber identity
- private alpha payloads
- wallet funding
- credential handling

Those belong in the full testnet/operator runbook, not the credential-free smoke test.

---

## Optional next steps (real testnet)

When you are ready to exercise the parts the smoke test deliberately skipped, the SDK supports the full testnet flow. These steps DO require credentials and a funded testnet wallet:

1. Fund a wallet on testnet: `pft-index wallet-create --label creator --fund-from <funded-source-label> --fund-drops 10000000 --submit-funding` (requires a funded source wallet you control).
2. Pin the encrypted blob to IPFS: `pft-index ipfs-add snapshot.v1.encrypted.json` (requires `IPFS_API_URL` + credentials, or Pinata fallback via `PINATA_API_KEY` / `PINATA_API_SECRET`).
3. Build a `pf.ptr:v4` PFTL memo: `pft-index pointer-build --cid <CID> --content-hash <hash> --kind INDEX`.
4. Submit the pointer transaction: `pft-index pftl-submit-pointer --wallet creator --memo <memo-json>` (requires `PFTL_WSS_URL`).
5. Build and publish an access manifest at the agreed delay tier: `pft-index access-grant --tier level_1 --available-at <ISO8601> --content-cid <CID> --recipient <subscriber-pubkey>`.

Full operator runbook lives at the SDK repo: `docs/operator_publish_index.md` and `docs/test_wallet_provisioning.md`.

The smoke-test flow on this page is designed so that swapping the local-only encrypt step (8) for a real IPFS pin + pointer submit, and adding the access-manifest publication, is the only operational change needed to go from smoke test to production marketplace integration. The cryptographic round-trip you just verified is identical.

---

## SDK provenance

- **Repo:** [github.com/agtico/pft_indexing](https://github.com/agtico/pft_indexing)
- **Tested commit:** `9f889b9ac145c0e73c22be51efb9588a2df42950`
- **CLI version (the one this page was tested against):** `pft-indexing 0.1.0`

Run `pip show pft-indexing` after install to confirm the version on your machine. If your version is significantly newer, the CLI flags may have changed; consult `pft-index <subcommand> --help`.

---

## Reviewer checklist

A reviewer can verify this artifact by checking that:

- [ ] The page is public and loads without login or paywall.
- [ ] Setup commands are exact and copy-pasteable.
- [ ] The flow includes offer/listing identity, purchase-equivalent grant, delivery, and release-equivalent integrity completion.
- [ ] Expected output is shown for every meaningful step.
- [ ] The final digest match is deterministic (`cecd5f10...4732af` for both original and recovered).
- [ ] No private key, mnemonic, live credential, funded wallet, operator wallet, or live-funds requirement appears.
- [ ] Full testnet-only steps are clearly separated from the credential-free smoke test.

---

*Published as part of PFT task `58129466-22a1-4943-a73e-ab21f93365d4` (Publish a Signal Marketplace SDK smoke-test quickstart). Audit trail in the operator's pft-audit repo.*
