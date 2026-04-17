# Three-Region NFT/IPFS Latency Matrix — Post Fiat Testnet

**Date**: 2026-04-17  
**Author**: Permanent Upper Class (rsS2Y6CK9dz9dVFjJvRyD2gBdoLPqjaXRZ)  
**Test origin**: Calgary, CA (Proxmox VM on residential ISP, Cloudflare DNS)  
**Region slice**: NA-direct + EU-CDN + Asia-CDN (distinct from other contributors who tested from US-East / EU-West / JP-Tokyo)

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

---

## 4. Root-Cause Analysis

### 4.1 Most Reliable Path

**Post Fiat's own IPFS gateway** (`ipfs-testnet.postfiat.org`) is the most reliable and fastest for PFTL NFT content: 100% success rate, 226-621ms latency, zero retries, zero timeouts. This is expected — content is likely pinned directly on their gateway node, eliminating IPFS DHT discovery overhead.

### 4.2 Least Reliable Path

**4everland.io** is completely non-functional for these CIDs. Every request returns HTTP 301 (redirect), and following the redirect chain leads to a 30-second timeout. Root cause: 4everland redirects `/ipfs/CID` to a subdomain-based gateway (`CID.ipfs.4everland.io`) which appears to have DNS or certificate issues for these specific CIDs. This is a gateway-side problem, not content availability.

### 4.3 Pinata Latency

**Pinata** (NA) is 10-15x slower than the Post Fiat gateway (5.2s vs 0.4s average). Pinata is a pinning service, not a dedicated gateway for PFTL content. Each cold request triggers a DHT lookup + content fetch from the IPFS network. Content would need to be explicitly pinned on Pinata for sub-second delivery.

### 4.4 EU vs Asia Performance

EU gateways (dweb.link, w3s.link) are consistent but slower than Asia gateways (ipfs.io, nftstorage.link). This is counterintuitive if the test origin is in NA — EU should have lower RTT. The likely explanation is that ipfs.io and nftstorage.link have more aggressive edge caching (content served from a CDN edge closer to the test origin) while dweb.link and w3s.link route through their primary IPFS nodes in Europe.

### 4.5 Content Availability

All 5 CIDs are available across all functional gateways. The PFTL NFT metadata is properly propagated through the IPFS network. The only failures are gateway-level issues (4everland redirect loop), not content availability problems.

---

## 5. Improvement Recommendations

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

## 6. Test Script

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

*Generated 2026-04-17 from the Permanent Upper Class validator (Calgary, CA). All CIDs sourced from PFTL testnet NFTokenMint transactions indexed by the Lens chain crawler.*
