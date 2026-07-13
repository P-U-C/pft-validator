# Post Fiat Validator Scoring Sidecar — Configuration & Implementation Feedback

**Task:** `task_7e373a3e24128e05bad02b22011f0758` — Set Up Post Fiat Validator Sidecar
**Validator:** `nHB6Zc7mhr7swksEgpwTE7Hw7SvZ9cz22T2MECMSXjBeMTeHXQB7` (`pft.permanentupperclass.com`, domain-verified)
**Date:** 2026-07-13 · **Network:** testnet · **Sidecar:** v1.0.1, participate mode

---

## 1. Outcome

The sidecar is **deployed, reproducing the foundation's scoring exactly, and running the participation loop.**

```
Score status: scored
Round number: 13
Backend mode: modal
Compared: True
Matched levels: RAW_MATCH, PARSED_MATCH, SELECTED_UNL_MATCH
```

All three convergence levels matched the foundation's published result for round 13, independently reproduced on our own H100.

```
Preflight: READY
  relay address: rrp5XAU9K76LFCx5y8mTa1rwDmUMznodbN
  [PASS] relay_wallet          [PASS] validator_key
  [PASS] rpc                   [PASS] relay_funding (100 PFT)
  [PASS] foundation_publisher  [PASS] round_reproduction (RAW + PARSED + SELECTED_UNL)
```

---

## 2. Configuration

Deployed at `/opt/validator-scoring-sidecar` on the validator host, per the setup guide. Secrets are `0600`, root-owned, and were never transmitted through chat.

```env
POSTFIAT_SCORING_BASE_URL=https://scoring-testnet.postfiat.org
POSTFIAT_SIDECAR_IPFS_GATEWAY_URL=https://ipfs-testnet.postfiat.org/ipfs
POSTFIAT_SIDECAR_NETWORK=testnet
POSTFIAT_SIDECAR_MODE=participate
POSTFIAT_SIDECAR_VALIDATOR_WALLET_SEED=sEd<REDACTED>
POSTFIAT_SIDECAR_VALIDATOR_KEYS_FILE=/opt/postfiatd/validator-keys.json
MODAL_TOKEN_ID=ak-<REDACTED>
MODAL_TOKEN_SECRET=as-<REDACTED>
POSTFIAT_SIDECAR_MODAL_KEY=wk-<REDACTED>
POSTFIAT_SIDECAR_MODAL_SECRET=ws-<REDACTED>

# non-default values this deployment required:
POSTFIAT_SIDECAR_TIMEOUT_SECONDS=180            # default 30
POSTFIAT_SIDECAR_INFERENCE_TIMEOUT_SECONDS=900  # default 180
POSTFIAT_SIDECAR_COMMAND_TIMEOUT_SECONDS=1200

# see §4 — this deployment's egress caps connections at 60s; scoring needs ~6 min
HTTPS_PROXY=http://192.168.6.130:8888
NO_PROXY=postfiat.org,.postfiat.org,localhost,127.0.0.1,192.168.0.0/16
```

Relay wallet `rrp5XAU9K76LFCx5y8mTa1rwDmUMznodbN` (ed25519) was generated **on the validator host** using the sidecar's own image (`--entrypoint python`, `xrpl.wallet.Wallet.create()`), written straight to a root-only `0600` file, and never printed. It is deliberately distinct from the validator identity, per the relay design.

`validator-keys.json` was `-rw-r--r-- postfiat:postfiat` (644) — the **validator's master secret was world-readable to every user on the host**. Corrected to `root:1000 640` as the docs require. Worth calling out in the setup guide as a security check, not just a "permission denied" fix.

---

## 3. What worked

- **Verify-only mode needs no validator at all.** It mounts nothing, needs no keys/wallet/GPU, and runs standalone — despite the docs listing "a validator already running on the host" as a prerequisite. This makes it an excellent zero-risk first step: prove the read path before wiring up money and a GPU. Suggest the docs say so explicitly.
- **Input-package verification** worked first try (10/10 files verified against the on-chain hash).
- **Determinism is real.** Digest-pinned image, pinned model revision, pinned launch args — and the reproduction matched at all three levels on the first successful run.
- **The relay-wallet design is sound.** Master key signs, separate funded wallet pays. Compromising the relay costs fees, not the validator.

---

## 4. What blocked progress

### 4.1 BLOCKER: a 6-minute inference on a single long-lived connection

A scoring pass is a 38 KB request (35 k-char prompt, `max_tokens: 16384`). The H100 generates 15,981 completion tokens (10,638 of them reasoning) at ~54 tok/s — **~6 minutes of wall clock on one HTTP connection.**

Modal holds that connection and issues a **303 at ~150 s** to a result-polling URL; `InferenceClient` sets `follow_redirects=True` specifically to follow it (its source comment says so).

This host's egress is a VPN that **severs connections at 60 s** — 90 s before the 303 can fire. Result: `RUNTIME_UNAVAILABLE`, every time.

Proven by holding everything constant and varying only egress:

| egress | result |
|---|---|
| validator host (VPN) | cut at **60.3 s** — `RemoteProtocolError: Server disconnected without sending a response` |
| second host, same VPN | cut at **60.4 s** |
| + TCP keepalive every 20 s | cut at 60.5 s — no help |
| + `stream: true` (**9,963 SSE chunks received**) | cut at 60.5 s — **data was flowing**, so this is a hard connection-*lifetime* cap, not an idle timeout |
| third host, no VPN | **HTTP 303 at 150.3 s → HTTP 200 at 392.8 s**, 48,401 bytes ✅ |
| validator host → CONNECT proxy on the non-VPN host | **HTTP 200 at 366.9 s** ✅ |

**Resolution (no code change):** a locked-down HTTP CONNECT proxy on a host outside the VPN (`Allow` limited to the validator's IP, `ConnectPort 443`), reached over the LAN. `HTTPS_PROXY` routes only the Modal call; `NO_PROXY` keeps the scoring API, PFTL RPC, IPFS and LAN traffic on the VPN untouched. httpx honours both natively.

**This will hit any operator behind a corporate firewall, VPN, or cloud NAT with a connection-lifetime cap** — a very common configuration. It is not exotic.

### 4.2 `RUNTIME_UNAVAILABLE` carries no error message

`error_details` is `null` — even under `score --json`, and even in the `sidecar_rounds` state table. The real exception is only obtainable by importing the package's own internals and re-running the call by hand:

```python
from validator_scoring_sidecar.score import load_model_request, _default_backend_factory
_default_backend_factory(record, timeout_seconds=900).run(load_model_request(pkg))
# -> InferenceError: could not reach inference endpoint at .../v1/chat/completions:
#    Server disconnected without sending a response.
```

That one sentence is the whole diagnosis, and it is discarded. **Hours were lost to a swallowed exception.** `InferenceError` already carries the message — surface it in `error_details` and print it on failure.

Compounding this: `RUNTIME_UNAVAILABLE` is raised from *two* unrelated causes (`httpx.RequestError` **and** `InferenceConfigError`), so the category alone can't distinguish "network died" from "missing credential."

### 4.3 `warm-runtime` reports `ready` while the model is still downloading

It validates the deployment record, not serving readiness. It printed `Runtime warm-up: ready` three separate times while the endpoint was ~10 % through a 30 GB download and could not serve a single request. A green light wired to the wrong signal — it should poll `/v1/models` (or `/health`) until it actually answers.

### 4.4 No `HF_TOKEN` support anywhere

Modal's own logs say it plainly:

```
Warning: You are sending unauthenticated requests to the HF Hub.
Please set a HF_TOKEN to enable higher rate limits and faster downloads.
```

`grep -r 'HF_TOKEN\|HUGGING_FACE' <package>` → **zero hits.** There is no env passthrough and no Modal secret for it. Every operator's first deploy pulls ~30 GB of weights unauthenticated and rate-limited; ours stalled for ~45 minutes. `_modal_app.py` already threads env into the image — adding an optional `HF_TOKEN` is a small change with a large payoff.

### 4.5 Minor

- First `deploy-modal` failed with `Please add a payment method to use H100 GPU functions` — worth stating up front in the prerequisites that free credits do not cover H100.
- Weights persist in a Modal Volume across cold starts (good design) — worth documenting, since it means a stalled first deploy resumes rather than restarting.

---

## 5. Recommended follow-ups (in priority order)

1. **Surface the inference error.** Put `InferenceError`'s message into `error_details` and print it. Highest value-per-line change in the codebase.
2. **Support long inference behind restrictive egress.** Either document `HTTPS_PROXY` as the supported escape hatch, or (better) add a polling client that submits and polls rather than holding one 6-minute connection. A `--poll` mode would make the sidecar work everywhere.
3. **Add optional `HF_TOKEN`** passthrough to the Modal image env.
4. **Make `warm-runtime` poll the endpoint** until it actually serves, instead of trusting the deployment record.
5. **Split `RUNTIME_UNAVAILABLE`** into distinct categories for transport failure vs configuration error.
6. **Docs:** state that verify-only needs no validator; add the `validator-keys.json` 640 check as a *security* step; note the H100 payment-method requirement.

---

## 6. Operational proof — validator and sidecar running together

```
### VALIDATOR AND SIDECAR RUNNING TOGETHER ON THE SAME HOST (postfiat-validator)
NAMES                       STATUS          IMAGE
validator-scoring-sidecar   Up 4 minutes    agtipft/validator-scoring-sidecar:testnet-participate-latest
postfiatd                   Up 9 days       agtipft/postfiatd:testnet-light-latest

### THE VALIDATOR IS PROPOSING (admin RPC, queried from inside the container)
  build_version: 1.0.4
  server_state: proposing
  network_id: 2025
  peers: 10
  pubkey_validator: nHB6Zc7mhr7swksEgpwTE7Hw7SvZ9cz22T2MECMSXjBeMTeHXQB7
  server_domain: pft.permanentupperclass.com
  validated_ledger seq: 4510036

### SECRET FILE PERMISSIONS
-rw-r----- 1 root postfiat  /opt/postfiatd/validator-keys.json      (was 644, world-readable)
-rw------- 1 root root      /opt/validator-scoring-sidecar/.env
-rw------- 1 root root      /opt/validator-scoring-sidecar/relay-wallet.seed

### PINNED RUNTIME
  image:            lmsysorg/sglang:nightly-dev-cu13-...@sha256:5d9ec71597ade6b8237d61ae6f01b976cb3d5ad2c1e3cf4e0acaf27a9ff49a65
  gpu_class:        H100
  served_model:     Qwen/Qwen3.6-27B-FP8
  model_revision:   e89b16ebf1988b3d6befa7de50abc2d76f26eb09

### INPUT PACKAGE VERIFICATION (sidecar's own state DB)
  round 12: hash=d9130da17a162f9a… verified_files=10 state=INPUT_PACKAGE_VERIFIED
  round 13: hash=13f8c335a31c3595… verified_files=10 state=SCORED
            matched=RAW_MATCH,PARSED_MATCH,SELECTED_UNL_MATCH
```

> **Note on `pubkey_validator`:** it is an **admin-only** field. Querying `server_info` over the host's
> published RPC port goes through docker-proxy, so postfiatd sees a non-localhost source and silently
> omits every admin field — making a healthy proposing validator look like it isn't validating at all.
> It must be queried from inside the container. This cost us real time and is worth a line in the docs.

---

## 7. Evidence index

| file | shows |
|---|---|
| `evidence/env.sanitized.txt` | full deployed configuration, secrets redacted |
| `evidence/operational-proof.txt` | validator + sidecar running together; `server_state: proposing`; file permissions; pinned runtime; 10/10 files verified |
| `evidence/preflight.txt` | `Preflight: READY`, all 6 checks |
| `evidence/score-round13.txt` | `Compared: True`, all 3 levels matched |
| `evidence/participate-loop.txt` | participation loop running on 60 s cycle |
| `evidence/vpn-60s-blocker.txt` | the 60 s cut, reproduced and controlled across 6 egress paths, with raw failure and success logs |
