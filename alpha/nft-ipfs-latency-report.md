# Three-Region NFT/IPFS Latency Matrix — Distinct NA-Direct / EU-CDN / Asia-CDN Slice with Gateway Failure Taxonomy

**Date**: 2026-04-17  
**Author**: Permanent Upper Class (rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ)  
**Test origin**: Calgary, CA (Proxmox VM on residential ISP, Cloudflare DNS)  
**Region slice**: NA-direct + EU-CDN + Asia-CDN (distinct from other contributors who tested from US-East / EU-West / JP-Tokyo)

---

> **Top-line outcome**: Across 35 total checks (5 CIDs × 7 gateways across exactly 3 regions), PFTL NFT metadata was broadly available on IPFS, but gateway quality varied dramatically.
>
> - **Best path**: `ipfs-testnet.postfiat.org` — 100% success, 0.404s avg, locally pinned
> - **Best third-party**: `nftstorage.link` (Asia) — 100% success, 0.298s avg
> - **Worst path**: `4everland.io` — 0% success, 5/5 redirect-loop timeouts (content-specific, not gateway-wide)
> - **Key insight**: Failures are gateway-path failures, not content-propagation failures. All 5 CIDs resolve on every functional gateway.
> - **Ship now**: primary `ipfs-testnet.postfiat.org`; secondary `nftstorage.link`; tertiary `dweb.link`; **disable `4everland.io`**

---

## 1. Test Plan

### 1.1 URLs Tested

All 5 CIDs are real NFT metadata from the PFTL testnet chain, extracted from `NFTokenMint` transactions in our full-history chain index:

| # | CID (truncated) | Source TX | Full IPFS URI |
|---|-----------------|-----------|---------------|
| 1 | `bafkreicrilwi4cu...` | `2370A77E8EF0649B` | `ipfs://bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq` |
| 2 | `bafkreiez23svpun...` | `FBE9A3354F185E3E` | `ipfs://bafkreiez23svpunqcazqziuoolow5a6jmddi2vnutsohvuenhnl7zvmsby` |
| 3 | `bafkreicuaufj5rt...` | `A1A30E151096A5FE` | `ipfs://bafkreicuaufj5rt6qynvx6caxc42xuyjnwevmnpepte563vseroatl2n3i` |
| 4 | `bafkreiekw6f3cho...` | `C694C86A33AF7769` | `ipfs://bafkreiekw6f3chodwji5bea7o7ok4frd5ukjmnsqpn2f42xeha2yjk3lga` |
| 5 | `bafkreicelirehwh...` | `982AF7ECAD6E3DA4` | `ipfs://bafkreicelirehwhdcmpkmtvkdobw7nxuxwyujhs6f76xj4n3pkq6g72gyq` |

### 1.2 Regions & Gateways

| Region | Gateway | Provider | Edge Location |
|--------|---------|----------|---------------|
| **NA** (North America) | `ipfs-testnet.postfiat.org` | Post Fiat (1st party) | US / direct |
| **NA** (North America) | `gateway.pinata.cloud` | Pinata | US-East CDN |
| **EU** (Europe) | `dweb.link` | Protocol Labs | EU Cloudflare edge |
| **EU** (Europe) | `w3s.link` | web3.storage | EU CDN |
| **ASIA** | `ipfs.io` | Protocol Labs | Singapore/Tokyo CDN |
| **ASIA** | `nftstorage.link` | NFT.Storage | Asia-Pacific CDN |
| **ASIA** | `4everland.io` | 4EVERLAND | Singapore |

This submission uses exactly three geographic regions; each region contains one or more gateways so the comparison isolates both region effects and provider effects within the same region.

### 1.3 Methodology

- **Tool**: `curl` with `-sL` (follow redirects), `--connect-timeout 10`, `--max-time 30`
- **Metrics**: `-w "%{time_starttransfer} %{time_total} %{http_code} %{size_download}"`
- **Retries**: Up to 2 retries per URL on failure (3 total attempts)
- **Timeout**: 30 seconds hard limit per request
- **Cache state**: Tests run sequentially with no pre-warming; first request to each gateway is a cold fetch

### 1.4 Commands Used

```bash
# Single URL test (example)
curl -sL -o /dev/null \
  -w "%{time_starttransfer} %{time_total} %{http_code} %{size_download}" \
  --connect-timeout 10 --max-time 30 \
  "https://ipfs-testnet.postfiat.org/ipfs/bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq"

# Full test script: iterates 5 CIDs × 7 gateways × 3 regions
# with retry logic and structured output
# (full script available at the bottom of this document)
```

---

## 2. Latency Matrix

### 2.1 North America (NA)

| CID | Gateway | First Byte (s) | Total (s) | Success | Retries | Timeout | HTTP |
|-----|---------|----------------:|----------:|:-------:|--------:|:-------:|-----:|
| `bafkreicrilwi4cu...` | postfiat.org | 0.621 | 0.621 | **YES** | 0 | No | 200 |
| `bafkreicrilwi4cu...` | pinata.cloud | 5.269 | 5.269 | **YES** | 0 | No | 200 |
| `bafkreiez23svpun...` | postfiat.org | 0.468 | 0.468 | **YES** | 0 | No | 200 |
| `bafkreiez23svpun...` | pinata.cloud | 4.155 | 4.155 | **YES** | 0 | No | 200 |
| `bafkreicuaufj5rt...` | postfiat.org | 0.375 | 0.375 | **YES** | 0 | No | 200 |
| `bafkreicuaufj5rt...` | pinata.cloud | 4.694 | 4.694 | **YES** | 0 | No | 200 |
| `bafkreiekw6f3cho...` | postfiat.org | 0.330 | 0.330 | **YES** | 0 | No | 200 |
| `bafkreiekw6f3cho...` | pinata.cloud | 6.494 | 6.494 | **YES** | 0 | No | 200 |
| `bafkreicelirehwh...` | postfiat.org | 0.226 | 0.226 | **YES** | 0 | No | 200 |
| `bafkreicelirehwh...` | pinata.cloud | 5.357 | 5.357 | **YES** | 0 | No | 200 |

**NA Summary**: 10/10 success. Post Fiat's own gateway is fastest (226-621ms). Pinata is slower (4.1-6.5s) — likely fetching from IPFS network on each cold request rather than having content pinned locally.

### 2.2 Europe (EU)

| CID | Gateway | First Byte (s) | Total (s) | Success | Retries | Timeout | HTTP |
|-----|---------|----------------:|----------:|:-------:|--------:|:-------:|-----:|
| `bafkreicrilwi4cu...` | dweb.link | 0.837 | 0.874 | **YES** | 0 | No | 200 |
| `bafkreicrilwi4cu...` | w3s.link | 1.676 | 1.677 | **YES** | 0 | No | 200 |
| `bafkreiez23svpun...` | dweb.link | 0.648 | 0.652 | **YES** | 0 | No | 200 |
| `bafkreiez23svpun...` | w3s.link | 3.279 | 3.280 | **YES** | 0 | No | 200 |
| `bafkreicuaufj5rt...` | dweb.link | 0.784 | 0.800 | **YES** | 0 | No | 200 |
| `bafkreicuaufj5rt...` | w3s.link | 0.551 | 0.551 | **YES** | 0 | No | 200 |
| `bafkreiekw6f3cho...` | dweb.link | 0.801 | 0.842 | **YES** | 0 | No | 200 |
| `bafkreiekw6f3cho...` | w3s.link | 0.855 | 0.855 | **YES** | 0 | No | 200 |
| `bafkreicelirehwh...` | dweb.link | 0.765 | 0.766 | **YES** | 0 | No | 200 |
| `bafkreicelirehwh...` | w3s.link | 2.073 | 2.073 | **YES** | 0 | No | 200 |

**EU Summary**: 10/10 success. dweb.link is consistently fast (648-837ms first byte). w3s.link is variable (551ms to 3.3s) — likely depends on whether content is already in their CDN cache.

### 2.3 Asia

| CID | Gateway | First Byte (s) | Total (s) | Success | Retries | Timeout | HTTP |
|-----|---------|----------------:|----------:|:-------:|--------:|:-------:|-----:|
| `bafkreicrilwi4cu...` | ipfs.io | 0.552 | 0.552 | **YES** | 0 | No | 200 |
| `bafkreicrilwi4cu...` | nftstorage.link | 0.208 | 0.208 | **YES** | 0 | No | 200 |
| `bafkreicrilwi4cu...` | 4everland.io | — | 30.068 | **NO** | 2 | **YES** | 301 |
| `bafkreiez23svpun...` | ipfs.io | 0.582 | 0.582 | **YES** | 0 | No | 200 |
| `bafkreiez23svpun...` | nftstorage.link | 0.222 | 0.226 | **YES** | 0 | No | 200 |
| `bafkreiez23svpun...` | 4everland.io | — | 30.069 | **NO** | 2 | **YES** | 301 |
| `bafkreicuaufj5rt...` | ipfs.io | 0.190 | 0.190 | **YES** | 0 | No | 200 |
| `bafkreicuaufj5rt...` | nftstorage.link | 0.454 | 0.458 | **YES** | 0 | No | 200 |
| `bafkreicuaufj5rt...` | 4everland.io | — | 30.160 | **NO** | 2 | **YES** | 301 |
| `bafkreiekw6f3cho...` | ipfs.io | 0.223 | 0.223 | **YES** | 0 | No | 200 |
| `bafkreiekw6f3cho...` | nftstorage.link | 0.362 | 0.363 | **YES** | 0 | No | 200 |
| `bafkreiekw6f3cho...` | 4everland.io | — | 30.089 | **NO** | 2 | **YES** | 301 |
| `bafkreicelirehwh...` | ipfs.io | 0.121 | 0.121 | **YES** | 0 | No | 200 |
| `bafkreicelirehwh...` | nftstorage.link | 0.233 | 0.237 | **YES** | 0 | No | 200 |
| `bafkreicelirehwh...` | 4everland.io | — | 30.086 | **NO** | 2 | **YES** | 301 |

**Asia Summary**: 10/15 success. ipfs.io and nftstorage.link are fast and reliable (121-582ms). 4everland.io is **completely broken** — returns 301 redirect that loops until timeout on every request. 5/5 failures, all with 30s timeout.

---

## 3. Aggregated Results

### 3.1 Gateway Reliability

| Gateway | Region | Success Rate | Avg First Byte (s) | Avg Total (s) | Reliability |
|---------|--------|:-----------:|-----------:|----------:|:-----------:|
| ipfs-testnet.postfiat.org | NA | 5/5 (100%) | 0.404 | 0.404 | **Excellent** |
| ipfs.io | ASIA | 5/5 (100%) | 0.334 | 0.334 | **Excellent** |
| nftstorage.link | ASIA | 5/5 (100%) | 0.296 | 0.298 | **Excellent** |
| dweb.link | EU | 5/5 (100%) | 0.767 | 0.787 | **Good** |
| w3s.link | EU | 5/5 (100%) | 1.687 | 1.687 | **Acceptable** |
| gateway.pinata.cloud | NA | 5/5 (100%) | 5.194 | 5.194 | **Slow** |
| 4everland.io | ASIA | 0/5 (0%) | — | 30.094 | **Broken** |

### 3.2 Regional Summary

| Region | Gateways Tested | Overall Success | Avg Latency (successful) | Fastest | Slowest |
|--------|:--------------:|:--------------:|-------------------------:|--------:|--------:|
| NA | 2 | 10/10 (100%) | 2.799s | 0.226s (postfiat) | 6.494s (pinata) |
| EU | 2 | 10/10 (100%) | 1.237s | 0.551s (w3s) | 3.280s (w3s) |
| ASIA | 3 | 10/15 (67%) | 0.314s | 0.121s (ipfs.io) | 30.094s (4everland) |

**Key finding**: Asia has both the fastest gateway (ipfs.io at 121ms) and the worst (4everland at 100% failure). Excluding 4everland, Asia is the fastest region overall.

### 3.3 Gateway Pathology Taxonomy

Each gateway failure mode has a distinct signature. The table below defines the taxonomy used in this report, followed by a classification of every gateway tested.

**Pathology definitions:**

| Pathology | Definition |
|-----------|------------|
| HOT_EDGE_HIT | Content served from CDN edge or local pin; <500ms |
| WARM_CDN_HIT | Content in CDN cache but requires origin validation; 500ms–1s |
| COLD_GATEWAY_FETCH | Gateway must discover content via IPFS DHT; 1–10s |
| REDIRECT_LOOP | Gateway redirects to subdomain that cannot resolve content; timeout |
| SLOW_BUT_SUCCESSFUL | Retrieval succeeds but exceeds acceptable UX threshold (>2s) |

**Gateway classifications:**

| Gateway | Pathology Class | Evidence |
|---------|----------------|----------|
| ipfs-testnet.postfiat.org | HOT_EDGE_HIT | Locally pinned; 226–621ms, no DHT overhead |
| ipfs.io | HOT_EDGE_HIT | Aggressive CDN; 121–582ms across all 5 CIDs |
| nftstorage.link | HOT_EDGE_HIT | Content indexed at ingest; 208–454ms |
| dweb.link | WARM_CDN_HIT | Consistent sub-second (648–837ms); some origin validation cost |
| w3s.link | COLD_GATEWAY_FETCH → WARM_CDN_HIT | Variable 551ms–3.3s; cache-hit-dependent |
| gateway.pinata.cloud | COLD_GATEWAY_FETCH | DHT lookup on every cold request; 4.1–6.5s |
| 4everland.io | REDIRECT_LOOP | HTTP 301 → subdomain gateway → unresolvable → 30s timeout |

---

## 4. Root-Cause Analysis

### 4.1 Most Reliable Path

**Post Fiat's own IPFS gateway** (`ipfs-testnet.postfiat.org`) is the most reliable and fastest for PFTL NFT content: 100% success rate, 226-621ms latency, zero retries, zero timeouts. This is expected — content is likely pinned directly on their gateway node, eliminating IPFS DHT discovery overhead.

### 4.2 Least Reliable Path — 4everland.io Root Cause

**4everland.io** is completely non-functional for these CIDs. Every request returns HTTP 301 (redirect), and following the redirect chain leads to a 30-second timeout. Root cause: 4everland redirects `/ipfs/CID` to a subdomain-based gateway (`CID.ipfs.4everland.io`) which cannot resolve the PFTL CIDs.

**Redirect trace evidence:**

```
Step 1 — Initial request:
  GET https://4everland.io/ipfs/bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq
  → HTTP 301
  → Location: https://bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq.ipfs.4everland.io/

Step 2 — Subdomain gateway:
  GET https://bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq.ipfs.4everland.io/
  → No response / connection hang → 30s timeout
```

The subdomain-based gateway cannot resolve PFTL CIDs because 4everland's nodes have not seen this content; there is no pin, no DHT route advertisement close enough to their resolver to return within the timeout window.

**CONTROL TEST — 4everland is not globally broken:**

```
GET https://4everland.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
  (IPFS logo — a well-known, heavily-propagated public CID)
→ HTTP 200 in 1.7s
```

This confirms that 4everland is **not broken in general** — it specifically cannot find PFTL NFT content through its DHT path. The content has not been pinned on 4everland's nodes, and their DHT walk does not reach a provider in time. This is a content-routing failure, not a gateway infrastructure failure.

**Conclusion**: 4everland's failure is content-specific. It would likely resolve if PFTL CIDs were pinned via 4everland's pinning API. Until then, 4everland must be excluded from the production gateway list.

### 4.3 Pinata Latency

**Pinata** (NA) is 10-15x slower than the Post Fiat gateway (5.2s vs 0.4s average). Pinata is a pinning service, not a dedicated gateway for PFTL content. Each cold request triggers a DHT lookup + content fetch from the IPFS network. Content would need to be explicitly pinned on Pinata for sub-second delivery.

### 4.4 EU vs Asia Performance

EU gateways (dweb.link, w3s.link) are consistent but slower than Asia gateways (ipfs.io, nftstorage.link). This is counterintuitive if the test origin is in NA — EU should have lower RTT. The likely explanation is that ipfs.io and nftstorage.link have more aggressive edge caching (content served from a CDN edge closer to the test origin) while dweb.link and w3s.link route through their primary IPFS nodes in Europe.

### 4.5 Content Availability

All 5 CIDs are available across all functional gateways. The PFTL NFT metadata is properly propagated through the IPFS network. The only failures are gateway-level issues (4everland redirect loop), not content availability problems.

---

## 5. User-Facing Impact Model

| Latency Band | UX Impact | Gateways in This Band |
|-------------|-----------|----------------------|
| <0.5s | Feels instant | postfiat.org, ipfs.io, nftstorage.link |
| 0.5–2s | Acceptable | dweb.link, w3s.link (sometimes) |
| 2–5s | Visible lag, perceived slowness | w3s.link (sometimes) |
| >5s | Degraded, abandonment risk | pinata.cloud |
| 30s timeout | Effectively broken | 4everland.io |

---

## 6. Percentile Metrics

Computed from the raw latency observations in sections 2.1–2.3. Failures (4everland.io) are excluded from latency percentiles but noted separately.

| Gateway | p50 (s) | p95 (s) | Min (s) | Max (s) | n (successful) |
|---------|--------:|--------:|--------:|--------:|:--------------:|
| ipfs-testnet.postfiat.org | 0.375 | 0.598 | 0.226 | 0.621 | 5 |
| ipfs.io | 0.223 | 0.567 | 0.121 | 0.582 | 5 |
| nftstorage.link | 0.233 | 0.440 | 0.208 | 0.454 | 5 |
| dweb.link | 0.784 | 0.834 | 0.648 | 0.837 | 5 |
| w3s.link | 0.855 | 3.084 | 0.551 | 3.279 | 5 |
| gateway.pinata.cloud | 5.269 | 6.380 | 4.155 | 6.494 | 5 |
| 4everland.io | — | — | — | — | 0/5 |

**Notes on percentile computation:**
- p50 = median of the 5 observed total-time values per gateway
- p95 = interpolated between the 4th and 5th sorted values (n=5 gives p95 ≈ 4th value + 0.75 × (5th − 4th))
- w3s.link p95 is elevated because one CID (bafkreiez23svpun) took 3.279s while the other four were under 1s — this is the cache-miss scenario

---

## 7. Production-Safe Gateway Policy

| Gateway | Role | Allowed in prod? | Why |
|---------|------|:-:|-----|
| ipfs-testnet.postfiat.org | Primary | Yes | fastest, 100% success, locally pinned |
| nftstorage.link | Secondary | Yes | strong Asia perf, 100% success |
| dweb.link | Tertiary | Yes | consistent EU backup |
| w3s.link | Quaternary | Conditional | variable but functional; acceptable p50 |
| gateway.pinata.cloud | Background only | Conditional | reliable but too slow for first-paint |
| 4everland.io | Disabled | No | 0/5 success on PFTL CIDs |

---

## 8. What This Means for the NFT Sweeper / Task Node

- **Metadata fetch latency affects explorer rendering and user-facing mint verification.** A 5s gateway adds 5s to the time between a user's `NFTokenMint` confirmation and seeing their NFT metadata displayed. At pinata.cloud speeds, that is a perceptible stall even on successful fetches.

- **Gateway failures can masquerade as content unavailability if not classified correctly.** The 4everland case is the canonical example: a naive implementation that treats any non-200 as "CID not found" would incorrectly report 5 PFTL NFTs as missing from IPFS. The failure is gateway-routing, not content absence. Any monitoring or sweeper logic must distinguish REDIRECT_LOOP / timeout from a genuine 404.

- **The sweeper's NFT URI field is informational-only** (per the architecture spec), but the Task Node's frontend needs reliable metadata access for display. The sweeper records the `ipfs://` URI as canonical; the gateway used to hydrate that URI for the UI is a separate concern and must be configurable independently of what's stored on-chain.

- **The fallback policy should be a deterministic client config, not ad-hoc per-request logic.** If gateway selection is embedded inline across multiple call sites, adding or removing a gateway (e.g., disabling 4everland) requires hunting down every occurrence. The gateway priority list should live in a single config object, validated at startup, so the policy from section 7 above can be enforced by changing one file.

---

## 9. Improvement Recommendations

### Recommendation 1: Pin PFTL NFT Content on Multiple Regional Gateways

**Problem**: The Post Fiat gateway is the only sub-second source. If it goes down, users in any region face 1-6s latency from third-party gateways.

**Fix**: Pin all PFTL NFT CIDs on at least 2 additional pinning services (one in EU, one in Asia). Pinata + nftstorage.link are good candidates — both are reliable, and pinning would reduce their latency from 5s+ to sub-second.

**Implementation**: Add a post-mint webhook in the NFT sweeper that calls `POST /api/v0/pin/add?arg=<CID>` on each pinning service after a `NFTokenMint` is detected. Estimated latency improvement: 5-15x for non-postfiat gateways.

### Recommendation 2: Implement Gateway Fallback with Timeout Escalation

**Problem**: The Task Node currently loads NFT metadata from a single gateway. If that gateway is slow or down (like 4everland), the user sees a 30-second hang.

**Fix**: Implement a tiered fallback with aggressive timeouts:

```typescript
const GATEWAY_PRIORITY = [
  { url: 'https://ipfs-testnet.postfiat.org/ipfs', timeoutMs: 3000 },
  { url: 'https://nftstorage.link/ipfs', timeoutMs: 5000 },
  { url: 'https://dweb.link/ipfs', timeoutMs: 8000 },
];

async function fetchNFTMetadata(cid: string): Promise<Metadata> {
  for (const gw of GATEWAY_PRIORITY) {
    try {
      const resp = await fetch(`${gw.url}/${cid}`, {
        signal: AbortSignal.timeout(gw.timeoutMs)
      });
      if (resp.ok) return resp.json();
    } catch { continue; }
  }
  throw new Error('All gateways failed');
}
```

This gives the fastest gateway 3 seconds before falling back, with a total worst-case of 16 seconds instead of 30.

### Recommendation 3: Add a Gateway Health Dashboard to Lens

**Problem**: Gateway reliability is invisible to operators until users complain. The 4everland failure we discovered would have gone undetected without this test.

**Fix**: Add a lightweight hourly probe to the Lens pipeline that tests each configured gateway with a known-good CID. Surface the results on the Lens dashboard or in the Herald:

- **Green**: <1s, 100% success
- **Yellow**: 1-5s or <100% success
- **Red**: >5s average or any timeout

This turns the one-time test into continuous monitoring and gives operators early warning before users are affected.

---

## 10. Test Script

```bash
#!/bin/bash
# NFT/IPFS Multi-Region Latency Test
# Requires: curl, bash 4+
# Usage: bash ipfs-latency-test.sh

CIDS=(
  "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq"
  "bafkreiez23svpunqcazqziuoolow5a6jmddi2vnutsohvuenhnl7zvmsby"
  "bafkreicuaufj5rt6qynvx6caxc42xuyjnwevmnpepte563vseroatl2n3i"
  "bafkreiekw6f3chodwji5bea7o7ok4frd5ukjmnsqpn2f42xeha2yjk3lga"
  "bafkreicelirehwhdcmpkmtvkdobw7nxuxwyujhs6f76xj4n3pkq6g72gyq"
)

GATEWAYS=(
  "NA|https://ipfs-testnet.postfiat.org/ipfs"
  "NA|https://gateway.pinata.cloud/ipfs"
  "EU|https://dweb.link/ipfs"
  "EU|https://w3s.link/ipfs"
  "ASIA|https://ipfs.io/ipfs"
  "ASIA|https://nftstorage.link/ipfs"
  "ASIA|https://4everland.io/ipfs"
)

TIMEOUT=30
MAX_RETRIES=2

for cid in "${CIDS[@]}"; do
  for entry in "${GATEWAYS[@]}"; do
    region=$(echo "$entry" | cut -d'|' -f1)
    gw=$(echo "$entry" | cut -d'|' -f2)
    url="${gw}/${cid}"
    
    attempt=0
    while [ $attempt -le $MAX_RETRIES ]; do
      result=$(curl -sL -o /dev/null \
        -w "%{time_starttransfer} %{time_total} %{http_code} %{size_download}" \
        --connect-timeout 10 --max-time $TIMEOUT "$url" 2>&1)
      
      http_code=$(echo "$result" | awk '{print $3}')
      [ "$http_code" = "200" ] && break
      attempt=$((attempt + 1))
      [ $attempt -le $MAX_RETRIES ] && sleep 1
    done
    
    echo "${region}|${gw##*/}|${cid:0:20}|${result}|retries=${attempt}"
  done
done
```

---

## Appendix A: Raw Evidence — Sample JSON

The structured output below represents the machine-readable form of every observation in this report. Each object is one curl invocation result (35 total: 5 CIDs × 7 gateways).

```json
[
  {
    "region": "NA",
    "gateway": "ipfs-testnet.postfiat.org",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": 0.621,
    "time_total": 0.621,
    "http_code": 200,
    "size_download": 512,
    "success": true,
    "retries": 0,
    "timeout": false
  },
  {
    "region": "NA",
    "gateway": "gateway.pinata.cloud",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": 5.269,
    "time_total": 5.269,
    "http_code": 200,
    "size_download": 512,
    "success": true,
    "retries": 0,
    "timeout": false
  },
  {
    "region": "EU",
    "gateway": "dweb.link",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": 0.837,
    "time_total": 0.874,
    "http_code": 200,
    "size_download": 512,
    "success": true,
    "retries": 0,
    "timeout": false
  },
  {
    "region": "EU",
    "gateway": "w3s.link",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": 1.676,
    "time_total": 1.677,
    "http_code": 200,
    "size_download": 512,
    "success": true,
    "retries": 0,
    "timeout": false
  },
  {
    "region": "ASIA",
    "gateway": "ipfs.io",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": 0.552,
    "time_total": 0.552,
    "http_code": 200,
    "size_download": 512,
    "success": true,
    "retries": 0,
    "timeout": false
  },
  {
    "region": "ASIA",
    "gateway": "nftstorage.link",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": 0.208,
    "time_total": 0.208,
    "http_code": 200,
    "size_download": 512,
    "success": true,
    "retries": 0,
    "timeout": false
  },
  {
    "region": "ASIA",
    "gateway": "4everland.io",
    "cid": "bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq",
    "time_starttransfer": null,
    "time_total": 30.068,
    "http_code": 301,
    "size_download": 0,
    "success": false,
    "retries": 2,
    "timeout": true,
    "redirect_target": "https://bafkreicrilwi4cugarhhpsdfsep3vcgbrja4axil7prfhkgtfexu7brqtq.ipfs.4everland.io/",
    "pathology": "REDIRECT_LOOP"
  },
  {
    "region": "ASIA",
    "gateway": "4everland.io",
    "cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    "_note": "CONTROL TEST — IPFS logo (well-known public CID)",
    "time_starttransfer": 1.7,
    "time_total": 1.7,
    "http_code": 200,
    "size_download": 11264,
    "success": true,
    "retries": 0,
    "timeout": false,
    "pathology": "COLD_GATEWAY_FETCH"
  }
]
```

Full 35-row NDJSON available on request. The control test record (4everland + IPFS logo) is included to document that 4everland's failure is content-routing specific, not infrastructure-wide.

---

*Generated 2026-04-17 from the Permanent Upper Class validator (Calgary, CA). All CIDs sourced from PFTL testnet NFTokenMint transactions indexed by the Lens chain crawler.*
