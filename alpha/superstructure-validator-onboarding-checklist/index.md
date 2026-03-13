---
layout: default
title: Superstructure Validator Onboarding Checklist
date: 2026-03-13
category: validator-operations
status: draft
---

# Superstructure Validator Onboarding Checklist

> Pre-flight guide for Post Fiat's one-click validator deployment — from zero to validating in under 30 minutes.

---

## Overview

The Superstructure one-click deploy transforms a 45-step manual validator setup into a single command. This checklist ensures you have everything ready before deploying, and guides you through monitoring and troubleshooting after.

---

## What You Are Creating

By the end of this guide, you will have:

1. **A validator node** — A server running the Post Fiat consensus software, syncing with the network
2. **A validator identity** — A cryptographic keypair that uniquely identifies your validator on the network
3. **An XRPL wallet** — A separate wallet for receiving PFT token rewards (not the same as your validator keys)
4. **Domain verification** — A two-way cryptographic link proving you control both the validator and the domain

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR VALIDATOR                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Validator  │  │   XRPL      │  │    Domain       │  │
│  │  Identity   │  │   Wallet    │  │    Verification │  │
│  │  (keys)     │  │   (rewards) │  │    (TOML)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│         │                │                  │            │
│         └────────────────┼──────────────────┘            │
│                          │                               │
│              All linked to YOUR domain                   │
└─────────────────────────────────────────────────────────┘
```

### Glossary

| Term | Meaning |
|------|---------|
| **Validator identity** | Your node's cryptographic keypair — public key is shared, private key file is secret |
| **XRPL wallet** | Separate account for receiving PFT rewards — has its own seed/keys |
| **Trust line** | XRPL permission allowing your wallet to hold a specific token (PFT) |
| **Attestation** | Cryptographic proof linking your validator identity to your domain |
| **UNL** | Unique Node List — the set of validators trusted for consensus |
| **Syncing** | Downloading and verifying the blockchain — must complete before validating |
| **Validating** | Actively participating in consensus (requires UNL inclusion) |
| **Validator token** | Base64-encoded credential derived from your validator keys |

---

## OPSEC Guidelines

### Public vs Private Material

| Material | Classification | Notes |
|----------|----------------|-------|
| Validator **public key** | PUBLIC | Safe to share, appears in TOML and explorer |
| Validator **key file** (`validator-keys.json`) | **SECRET** | Never share, never commit to git |
| Validator **token** | **SECRET** | Derived from keys, treat as secret |
| XRPL wallet **address** | PUBLIC | Safe to share for receiving rewards |
| XRPL wallet **seed** | **SECRET** | Never share, controls your funds |
| Server IP | PRIVATE | Limit exposure where possible |
| Webhook URLs | PRIVATE | Can be abused for spam if leaked |

### Secret Handling Rules

```bash
# ❌ NEVER do this — leaks to shell history
export SEED="sXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

# ✅ Use .env file with restricted permissions
echo "SEED=sXXXXXX" > .env
chmod 600 .env

# ✅ Or use interactive prompt
read -s -p "Enter seed: " SEED
```

**Do NOT run sensitive commands on:**
- Shared shell hosts
- Recorded terminal sessions (asciinema, script)
- CI/CD logs without secret masking

### File Permissions

```bash
# Validator keys — owner read-only
chmod 600 /opt/postfiatd/validator-keys.json

# Config file — owner read-write
chmod 600 /opt/postfiatd/postfiatd.cfg

# Verify permissions
ls -la /opt/postfiatd/*.json /opt/postfiatd/*.cfg
```

### Network Exposure Model

```
Internet ──► Port 51235 (peer-to-peer) ──► Validator
             Port 22 (SSH, key auth only) ──► You

Localhost only (NEVER expose):
  - Port 5005 (admin RPC)
  - Port 6006 (admin WebSocket)
  - Port 3000 (Grafana) ← bind to localhost or VPN
  - Port 9090 (Prometheus)
```

**Firewall baseline:**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 51235/tcp   # Peers
sudo ufw enable
```

⚠️ **If you accidentally expose your validator keys, generate new ones immediately and update your domain attestation.**

**What the one-click deploy does:**
- Pre-checks hardware and network
- Installs Docker and dependencies
- Generates validator keys
- Configures the node with your domain
- Starts the validator container
- Bootstraps monitoring (Prometheus + Grafana)
- Sends startup notification to your Discord

**What you must do manually:**
- Provision a VPS or server
- Own or control a domain
- Create and fund an XRPL wallet
- Host your TOML verification file

---

## 1. Prerequisites

### Hardware Requirements

| Spec | Minimum | Recommended |
|------|---------|-------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Storage | 200 GB NVMe SSD | 250 GB NVMe SSD |
| Network | 500 Mbps | 1 Gbps |
| OS | Ubuntu 22.04+ LTS | Ubuntu 24.04 LTS |
| Architecture | x86_64 | x86_64 |

**Pre-flight hardware check:**
```bash
#!/bin/bash
echo "=== Hardware Pre-flight ==="
echo "CPU cores: $(nproc)"
echo "RAM: $(free -g | awk '/Mem:/ {print $2}') GB"
echo "Disk: $(df -h / | awk 'NR==2 {print $4}') available"
echo "Arch: $(uname -m)"
[[ $(nproc) -ge 4 ]] && echo "✅ CPU OK" || echo "❌ CPU: need 4+ cores"
[[ $(free -g | awk '/Mem:/ {print $2}') -ge 8 ]] && echo "✅ RAM OK" || echo "❌ RAM: need 8+ GB"
[[ $(uname -m) == "x86_64" ]] && echo "✅ Arch OK" || echo "❌ Arch: x86_64 required"
```

### Network Requirements

| Port | Direction | Protocol | Purpose |
|------|-----------|----------|---------|
| 51235 | Inbound | TCP | Peer-to-peer (XRPL default) |
| 5005 | **Local only** | HTTP | Admin JSON-RPC |
| 6006 | **Local only** | WSS | Admin WebSocket |
| 22 | Inbound | TCP | SSH (your access) |

⚠️ **OPSEC: Validators should NOT expose public APIs.** Ports 5005 and 6006 must be localhost-only. If you need public API access, run a separate non-validator node behind a reverse proxy.

**Pre-flight network check:**
```bash
#!/bin/bash
echo "=== Network Pre-flight ==="
echo "Public IP: $(curl -4 -s ifconfig.me)"
nc -z -w5 postfiat.org 443 && echo "✅ Outbound HTTPS OK" || echo "❌ Outbound blocked"
```

**Firewall rules (if using UFW):**
```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 51235/tcp   # Peer-to-peer
# Do NOT expose 5005 or 6006 — admin ports stay local-only
sudo ufw enable
```

### VPS Recommendations

| Provider | Instance | ~Cost/mo | Notes |
|----------|----------|----------|-------|
| **Vultr** | High Frequency 8GB | $48 | Crypto-friendly, recommended |
| **DigitalOcean** | Regular 8GB | $48 | Good support |
| **Hetzner** | CPX31 | €24 | ⚠️ Check ToS for crypto |
| **OVH** | B2-30 | €30 | European alternative |

**Avoid:**
- ARM instances (x86_64 only)
- Shared/burst CPU (t2/t3 micro)
- Network-attached storage (AWS EBS)
- Providers that ban crypto operations

### Security Hardening (Pre-Deploy)

Before running the validator, harden your server:

```bash
# 1. Disable password authentication (use SSH keys only)
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 2. Install fail2ban (blocks repeated failed SSH attempts)
sudo apt update && sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# 3. Enable unattended security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 4. Verify firewall is active
sudo ufw status
```

**SSH key setup (if not already done):**
```bash
# On your LOCAL machine, generate a key
ssh-keygen -t ed25519 -C "validator-access"

# Copy to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@your-server-ip
```

### Software Prerequisites

The one-click deploy will install these, but if you want to verify beforehand:

```bash
# Check if Docker is installed
docker --version || echo "Docker will be installed"

# Check if curl is available
curl --version || echo "curl will be installed"

# Check OS version
cat /etc/os-release | grep -E "^(NAME|VERSION_ID)"
```

---

## 2. Wallet and Identity Setup

### 2.1 Create XRPL Wallet

Post Fiat validators need an XRPL wallet to receive rewards and participate in network governance.

**Option A: Command-line (recommended for operators)**
```bash
# Install xrpl-py
pip install xrpl

# Generate wallet
python3 -c "
from xrpl.wallet import Wallet
w = Wallet.create()
print('Address:', w.classic_address)
print('Seed:', w.seed)
print()
print('⚠️ SAVE YOUR SEED OFFLINE. NEVER SHARE IT.')
"
```

**Option B: Use existing wallet tools**
- XUMM mobile wallet (recommended for beginners)
- Post Fiat CLI wallet: https://goodalexander.com/posts/post_fiat_install/

### 2.2 Fund Your Wallet

Your wallet needs:
- **1 XRP** — Base account reserve (as of Dec 2024)
- **0.2 XRP per trust line** — Owner reserve for ledger objects
- **Recommended: 5-10 XRP** — Operational buffer for fees and future trust lines

*Note: The base reserve was lowered from 10 XRP to 1 XRP in December 2024.*

Funding sources:
- Transfer from exchange (Coinbase, Kraken, Bitstamp)
- Purchase via onramp (MoonPay, Transak)

### 2.3 Configure Trust Line

Post Fiat tokens (PFT) require a trust line to the issuer. A trust line is an XRPL mechanism that allows your wallet to hold tokens issued by another account.

⚠️ **Superstructure-specific values below** — verify issuer address from official Post Fiat docs before use.

**Option A: XUMM Wallet (Recommended for beginners)**
1. Open XUMM app
2. Go to Settings → Trust Lines → Add
3. Enter currency: `PFT`
4. Enter issuer: `rnQUEEg8yyjrwk9FhyXpKavHyCRJM9BDMW` *(verify from official docs)*
5. Confirm transaction

**Option B: Command-line (Advanced)**

Create a script file (don't paste seeds in shell):

```bash
# Create the script
cat > setup_trustline.py << 'EOF'
import os
from xrpl.clients import JsonRpcClient
from xrpl.wallet import Wallet
from xrpl.models.transactions import TrustSet
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.transaction import submit_and_wait

# Read seed from environment (set via .env file, not shell)
seed = os.environ.get("XRPL_SEED")
if not seed:
    import getpass
    seed = getpass.getpass("Enter wallet seed: ")

# Superstructure-specific: verify this issuer from official docs
PFT_ISSUER = "rnQUEEg8yyjrwk9FhyXpKavHyCRJM9BDMW"

client = JsonRpcClient("https://xrplcluster.com")
wallet = Wallet.from_seed(seed)

trust_set = TrustSet(
    account=wallet.classic_address,
    limit_amount=IssuedCurrencyAmount(
        currency="PFT",
        issuer=PFT_ISSUER,
        value="1000000000"
    )
)

response = submit_and_wait(trust_set, client, wallet)
print("Trust line result:", response.result["meta"]["TransactionResult"])
EOF

# Run with interactive prompt (seed never in shell history)
pip install xrpl-py
python3 setup_trustline.py
```

### 2.4 Domain Ownership and Verification

Domain verification creates a **two-way cryptographic link**:

```
1. Validator → Domain:  Your validator config declares "I am validator.yourdomain.com"
2. Domain → Validator:  Your TOML file declares "Validator nHUxxx is authorized for this domain"
```

Both sides must agree. This proves you control both the validator and the domain.

**Requirements:**
- Domain with HTTPS support (required for TOML access)
- Ability to host files at `/.well-known/xrp-ledger.toml`
- DNS control (to point to GitHub Pages or your own hosting)
- CORS enabled for the TOML file (`Access-Control-Allow-Origin: *`)

**Easiest option:** GitHub Pages (free, HTTPS included, CORS handled automatically)

### 2.5 Network Selection

| Network | Purpose | Image Tag | Notes |
|---------|---------|-----------|-------|
| **Testnet** | Testing, development | `devnet-light-latest` | Safe for experimentation |
| **Mainnet** | Production validation | `mainnet-latest` | Real rewards, real consequences |

**Start with testnet** until you've verified:
- Node syncs successfully
- Domain verification works
- Monitoring captures metrics
- You understand the operational requirements

### 2.6 Identity Checklist

Before running one-click deploy, confirm:

- [ ] XRPL wallet created
- [ ] Wallet funded with 5+ XRP
- [ ] Trust line configured for PFT token
- [ ] Domain owned and accessible
- [ ] DNS credentials available
- [ ] Server security hardened (SSH keys, fail2ban)
- [ ] Decided: testnet or mainnet

---

## 3. One-Click Deployment Steps

### 3.1 Download and Run

```bash
# SSH into your server
ssh root@your-server-ip

# Download and run the one-click installer
curl -fsSL https://superstructure.postfiat.org/deploy.sh | bash
```

### 3.2 Interactive Prompts

The installer will prompt for:

| Prompt | Example Input | Notes |
|--------|---------------|-------|
| Your domain | `validator.yourdomain.com` | Used for identity verification |
| Discord webhook URL | `https://discord.com/api/webhooks/...` | For alerts (optional) |
| Enable monitoring? | `y` | Prometheus + Grafana stack |
| Grafana admin password | `your-secure-password` | For dashboard access |

### 3.3 Environment Variables (Advanced)

For automated deployments, set these before running:

```bash
export SUPERSTRUCTURE_DOMAIN="validator.yourdomain.com"
export SUPERSTRUCTURE_DISCORD_WEBHOOK="https://discord.com/api/webhooks/..."
export SUPERSTRUCTURE_MONITORING="true"
export SUPERSTRUCTURE_GRAFANA_PASSWORD="your-password"
export SUPERSTRUCTURE_NONINTERACTIVE="true"

curl -fsSL https://superstructure.postfiat.org/deploy.sh | bash
```

### 3.4 Expected Output

```
=== Superstructure Validator Deploy ===

[1/8] Pre-flight checks...
  ✅ CPU: 8 cores
  ✅ RAM: 16 GB
  ✅ Disk: 180 GB available
  ✅ Architecture: x86_64
  ✅ Network: outbound OK

[2/8] Installing dependencies...
  ✅ Docker 24.0.7
  ✅ Docker Compose 2.21.0

[3/8] Generating validator identity...
  ✅ Keys generated: /opt/postfiatd/validator-keys.json
  ⚠️ BACKUP THIS FILE IMMEDIATELY

[4/8] Configuring node...
  ✅ Domain: validator.yourdomain.com
  ✅ Config written: /opt/postfiatd/postfiatd.cfg

[5/8] Generating attestation...
  ✅ Attestation: ABC123...XYZ
  📋 Copy this to your TOML file (instructions below)

[6/8] Starting validator...
  ✅ Container: postfiatd (running)
  ✅ State: syncing (will reach 'full' in ~10 minutes)

[7/8] Starting monitoring...
  ✅ Prometheus: http://localhost:9090
  ✅ Grafana: http://your-ip:3000 (admin / your-password)
  ✅ Alertmanager: http://localhost:9093

[8/8] Post-deploy verification...
  ✅ RPC responding
  ✅ 8 peers connected
  ⏳ Ledger syncing: 45,230,100 / 45,234,500

=== DEPLOY COMPLETE ===

NEXT STEPS:
1. Back up /opt/postfiatd/validator-keys.json to offline storage
2. Host your TOML file (instructions: https://docs.postfiat.org/toml)
3. Join Discord: https://discord.gg/postfiat
4. Request your first task to start earning

Your validator public key: nHUVPzAmAmQ2QSc4oE1iLfsGi17qN2ado8PhxvgEkou76FLxAz7C
Your attestation: [base64-string-here]

TOML file content (host at yourdomain.com/.well-known/xrp-ledger.toml):
---
[[VALIDATORS]]
public_key = "nHUVPzAmAmQ2QSc4oE1iLfsGi17qN2ado8PhxvgEkou76FLxAz7C"
attestation = "[your-attestation-string]"
network = "main"

# Note: The domain is inferred from where this file is hosted.
# The [METADATA] section below is Superstructure-specific (not standard XRPL).
[METADATA]
network = "postfiat"
---

⚠️ **CORS requirement:** Your web server must serve this file with:
```
Access-Control-Allow-Origin: *
```
GitHub Pages handles this automatically. For nginx, add to your config:
```nginx
location /.well-known/xrp-ledger.toml {
    add_header Access-Control-Allow-Origin *;
}
```

Bookmark this page: https://docs.postfiat.org/validator-guide
```

### 3.5 Generated Files

After deployment, these files exist:

| Path | Purpose | Backup? |
|------|---------|---------|
| `/opt/postfiatd/validator-keys.json` | Validator identity | **YES - CRITICAL** |
| `/opt/postfiatd/postfiatd.cfg` | Node configuration | Yes |
| `/opt/postfiatd/docker-compose.yml` | Container orchestration | No (regenerable) |
| `/opt/postfiatd/validator-token.txt` | Auth token (derived from keys) | No (regenerable) |
| `/opt/pf-monitor/` | Monitoring stack | No (regenerable) |

### 3.6 Verify Deployment

```bash
# Check node status
curl -s -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"method":"server_info","params":[{}]}' | python3 -c "
import sys,json
d=json.load(sys.stdin)['result']['info']
print('State:', d.get('server_state'))
print('Peers:', d.get('peers'))
print('Ledger:', d.get('validated_ledger',{}).get('seq','syncing'))
print('Domain:', d.get('server_domain','NOT SET'))
"
```

Expected (after ~10 minutes):
```
State: full
Peers: 15
Ledger: 45234567
Domain: validator.yourdomain.com
```

### 3.7 Success Criteria

**Level 1: Node Running** (achievable in ~30 min)
- [ ] Container running (`docker ps` shows postfiatd)
- [ ] State reaches `full` (synced with network)
- [ ] 10+ peers connected
- [ ] Admin RPC responds on localhost:5005

**Level 2: Identity Verified** (achievable in ~1 hour)
- [ ] TOML file accessible at `https://yourdomain.com/.well-known/xrp-ledger.toml`
- [ ] Domain shows in `server_info` response
- [ ] Attestation matches between config and TOML

**Level 3: Operational** (ongoing)
- [ ] Monitoring dashboard shows green
- [ ] Alerts configured and tested
- [ ] Validator visible on network explorer
- [ ] 99.9% uptime maintained

**Level 4: Earning** (requires network participation)
- [ ] Joined Post Fiat Discord
- [ ] Completed first task
- [ ] Received PFT rewards
- [ ] Top-50 economic activity (for monthly distribution)

### 3.8 Backup and Recovery

**Critical: Back up immediately after deploy**

```bash
# Create encrypted backup of validator identity
tar -czf validator-backup-$(date +%Y%m%d).tar.gz \
  /opt/postfiatd/validator-keys.json \
  /opt/postfiatd/postfiatd.cfg

# Encrypt with GPG (recommended)
gpg -c validator-backup-$(date +%Y%m%d).tar.gz

# Store the .gpg file:
# - USB drive (offline)
# - Password manager
# - Encrypted cloud storage
# - Paper backup of the seed (if available)
```

**Recovery procedure:**
```bash
# On new server, after base install:
# 1. Copy backup file to server
# 2. Decrypt
gpg -d validator-backup-YYYYMMDD.tar.gz.gpg > validator-backup.tar.gz

# 3. Extract
tar -xzf validator-backup.tar.gz -C /

# 4. Re-run deploy (will detect existing keys)
curl -fsSL https://superstructure.postfiat.org/deploy.sh | bash
```

⚠️ **If you lose validator-keys.json, your validator identity is gone permanently.** You would need to generate new keys and re-verify your domain.

---

## 4. Monitoring and Alerting Configuration

The one-click deploy includes the full [pf-monitor](https://github.com/P-U-C/pf-monitor) stack.

### 4.1 Components

| Component | URL | Purpose |
|-----------|-----|---------|
| Prometheus | `http://localhost:9090` | Metrics collection |
| Grafana | `http://your-ip:3000` | Dashboard visualization |
| Alertmanager | `http://localhost:9093` | Alert routing |
| postfiatd_exporter | `http://localhost:9100` | Custom metrics |

### 4.2 Pre-Built Dashboard

Access Grafana at `http://your-server-ip:3000`

Login: `admin` / (password you set during deploy)

The **PF Validator Overview** dashboard shows:
- Node state and uptime
- Peer connections (inbound/outbound)
- Ledger age and sync status
- CPU, RAM, disk usage
- Container health
- Config file integrity

### 4.3 Alert Rules

25+ pre-configured alerts organized by severity:

**Critical (immediate notification):**
- Node down for > 2 minutes
- Container OOM killed
- Validator keys file missing
- Disk > 95% full

**Warning (5-minute delay):**
- Ledger age > 60 seconds
- Peers < 5
- CPU > 80% sustained
- RAM > 90%
- Config file changed

**Info (daily digest):**
- Amendment votes changed
- Fee spikes detected

### 4.4 Discord Alert Setup

If you provided a Discord webhook during deploy, alerts are already configured.

To add later:
```bash
# Edit alertmanager config
nano /opt/pf-monitor/alertmanager/alertmanager.yml

# Add webhook
receivers:
  - name: 'discord'
    slack_configs:
      - api_url: 'https://discord.com/api/webhooks/YOUR_WEBHOOK/slack'
        channel: '#alerts'

# Restart
cd /opt/pf-monitor && docker compose restart alertmanager
```

### 4.5 Minimum Telemetry Requirements

For Superstructure validators to be scored fairly, ensure these metrics are exposed:

| Metric | Purpose | Required |
|--------|---------|----------|
| `postfiatd_up` | Node availability | Yes |
| `postfiatd_server_state` | Consensus participation | Yes |
| `postfiatd_peers_total` | Network connectivity | Yes |
| `postfiatd_ledger_age_seconds` | Sync health | Yes |
| `postfiatd_validated_ledger_seq` | Chain progress | Yes |
| `node_cpu_seconds_total` | Resource usage | Recommended |
| `node_memory_MemAvailable_bytes` | Resource usage | Recommended |

### 4.6 Remote Monitoring (Split Architecture)

For maximum resilience, run the monitoring stack on a separate server:

```bash
# On validator server (exporters only)
cd /opt/pf-monitor
./setup.sh split-validator

# On monitoring server
git clone https://github.com/P-U-C/pf-monitor
cd pf-monitor
./setup.sh split-monitor
# When prompted, enter validator IP
```

This ensures alerts work even if the validator server is completely down.

---

## 5. Troubleshooting Guide

> **Note:** Commands in this section use Superstructure-specific conventions:
> - Container name: `postfiatd`
> - Install path: `/opt/postfiatd/`
> - Image: `agtipft/postfiatd:devnet-light-latest`
> 
> For docker compose commands, run from `/opt/postfiatd/`:
> ```bash
> cd /opt/postfiatd
> docker compose ps        # List containers
> docker compose logs -f   # View logs
> docker compose restart   # Restart
> ```

### 5.1 Port Conflicts

**Symptom:** Deploy fails with "port already in use" or container won't start.

**Diagnosis:**
```bash
# Check what's using the ports
sudo lsof -i :51235  # Peer-to-peer
sudo lsof -i :5005   # Admin RPC
sudo lsof -i :6006   # Admin WS
sudo lsof -i :3000   # Grafana
sudo lsof -i :9090   # Prometheus
```

**Remediation:**
```bash
# Option A: Kill conflicting process
sudo kill -9 $(sudo lsof -t -i :PORT_NUMBER)

# Option B: Change ports in config
nano /opt/postfiatd/docker-compose.yml
# Change port mappings, e.g., "3001:3000" for Grafana

# Restart
cd /opt/postfiatd && docker compose up -d
```

**Prevention:** Use a fresh server or run the pre-flight port check:
```bash
for port in 51235 5005 6006 3000 9090 9093; do
  nc -z localhost $port && echo "❌ Port $port in use" || echo "✅ Port $port free"
done
```

### 5.2 Insufficient Resources

**Symptom:** Container keeps restarting, OOM kills in logs, extreme slowness.

**Diagnosis:**
```bash
# Check memory
free -h

# Check container stats
docker stats --no-stream

# Check for OOM kills
dmesg | grep -i "out of memory" | tail -5
journalctl -k | grep -i "oom" | tail -5

# Check container exit reasons
docker inspect postfiatd --format='{{.State.OOMKilled}}'
```

**Remediation:**
```bash
# Option A: Add swap (temporary fix)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Option B: Reduce ledger history (if available)
# Edit postfiatd.cfg and reduce online_delete setting

# Option C: Upgrade server (recommended)
# Migrate to 16GB RAM instance
```

**Prevention:** Always use 16GB RAM for production. The 8GB minimum is for testing only.

### 5.3 Stale Chain State

**Symptom:** Node stuck syncing, ledger age keeps growing, state shows "syncing" for hours.

**Diagnosis:**
```bash
# Check current state
curl -s -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"method":"server_info","params":[{}]}' | python3 -c "
import sys,json
d=json.load(sys.stdin)['result']['info']
print('State:', d.get('server_state'))
print('Peers:', d.get('peers'))
print('Ledger age:', d.get('validated_ledger',{}).get('age','unknown'), 'seconds')
"

# Check if peers are connected
curl -s -X POST http://localhost:5005/ \
  -d '{"method":"peers"}' | python3 -c "
import sys,json
p=json.load(sys.stdin)['result'].get('peers',[])
print('Peer count:', len(p))
for peer in p[:3]:
    print(' -', peer.get('address'), peer.get('version'))
"

# Check logs for sync issues
docker logs postfiatd 2>&1 | grep -i "sync\|ledger\|stale" | tail -10
```

**Remediation:**
```bash
# Option A: Wait longer (sync can take 30+ minutes on slow connections)

# Option B: Restart the node
cd /opt/postfiatd && docker compose restart postfiatd

# Option C: Force resync from scratch (nuclear option)
cd /opt/postfiatd
docker compose down
rm -rf data/db/*  # Delete ledger data
docker compose up -d

# Option D: Check network connectivity
nc -zv seed.postfiat.org 51235
```

**Prevention:** Ensure stable network with low latency. Avoid VPN tunnels that add latency.

### 5.4 Validator Token Not Loading

**Symptom:** `pubkey_validator: NONE` in server_info, logs show "no validator token".

**Diagnosis:**
```bash
# Check if token exists
cat /opt/postfiatd/postfiatd.cfg | grep -A2 'validator_token'

# Check token length (should be ~800+ characters)
grep -A1 'validator_token' /opt/postfiatd/postfiatd.cfg | tail -1 | wc -c

# Check for line breaks in token
grep -A1 'validator_token' /opt/postfiatd/postfiatd.cfg | tail -1 | od -c | head
```

**Remediation:**
```bash
# Regenerate token from keys
docker run --rm -v /opt/postfiatd:/data agtipft/postfiatd:devnet-light-latest \
  validator-keys create_token --keyfile /data/validator-keys.json > /opt/postfiatd/validator-token.txt

# Update config (ensure single line, no breaks)
TOKEN=$(cat /opt/postfiatd/validator-token.txt)
sed -i "s|\[validator_token\].*|[validator_token]\n$TOKEN|" /opt/postfiatd/postfiatd.cfg

# Restart
cd /opt/postfiatd && docker compose restart postfiatd

# Verify
docker logs postfiatd 2>&1 | grep -i "validator identity"
```

### 5.5 Domain Verification Failing

**Symptom:** Domain not showing on explorer, TOML returns 404.

**Diagnosis:**
```bash
# Check TOML is accessible
curl -sI https://yourdomain.com/.well-known/xrp-ledger.toml

# Check TOML content
curl -s https://yourdomain.com/.well-known/xrp-ledger.toml

# Verify DNS is pointing correctly
dig yourdomain.com +short

# Check HTTPS certificate
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Remediation:**

For GitHub Pages 404:
```bash
# Add _config.yml to repo root
echo "include: ['.well-known']" > _config.yml
git add _config.yml && git commit -m "Include .well-known" && git push
```

For wrong attestation:
```bash
# Regenerate with correct domain
docker exec postfiatd validator-keys --keyfile /tmp/validator-keys.json set_domain yourdomain.com
# Update TOML with new attestation
# Update config with new token
# Restart validator
```

### 5.6 Monitoring Not Working

**Symptom:** Grafana shows no data, Prometheus targets down.

**Diagnosis:**
```bash
# Check all containers running
docker ps | grep -E "prometheus|grafana|alertmanager|exporter"

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import sys,json
for t in json.load(sys.stdin)['data']['activeTargets']:
    print(t['labels'].get('job','?'), '-', t['health'])
"

# Check exporter
curl -s http://localhost:9100/metrics | head -20
```

**Remediation:**
```bash
# Restart monitoring stack
cd /opt/pf-monitor && docker compose restart

# If exporter failing, check postfiatd is up
curl -s http://localhost:5005/ -d '{"method":"ping"}'

# Reconfigure Prometheus targets
nano /opt/pf-monitor/prometheus/prometheus.yml
# Verify targets are correct
cd /opt/pf-monitor && docker compose restart prometheus
```

---

## 6. Upgrades and Maintenance

### 6.1 Updating the Validator Image

```bash
cd /opt/postfiatd

# Check current version
docker compose images

# Pull latest image
docker compose pull

# Rolling restart (brief downtime)
docker compose down
docker compose up -d

# Verify
docker compose logs -f --tail 50
```

**Pre-upgrade checklist:**
- [ ] Backup validator-keys.json
- [ ] Note current ledger sequence
- [ ] Check #announcements for breaking changes
- [ ] Schedule during low-activity period if possible

### 6.2 Log Rotation

Prevent disk fill from container logs:

```bash
# Add to /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}

# Restart Docker
sudo systemctl restart docker
```

### 6.3 NTP/Time Sync

Consensus requires accurate time. Verify:

```bash
# Check time sync status
timedatectl status

# If not synced, enable NTP
sudo timedatectl set-ntp on

# Verify
timedatectl show --property=NTPSynchronized
```

### 6.4 Disk Monitoring

Estimated ledger growth: ~2-5 GB/month (varies with network activity)

```bash
# Check current usage
df -h /opt/postfiatd

# Set up alert (add to cron)
echo '[ $(df /opt/postfiatd --output=pcent | tail -1 | tr -d " %") -gt 80 ] && echo "Disk warning: $(df -h /opt/postfiatd)"' | crontab -
```

### 6.5 Security Updates

```bash
# Check for updates
sudo apt update && apt list --upgradable

# Apply security updates
sudo unattended-upgrade --dry-run  # Preview
sudo unattended-upgrade            # Apply

# Reboot if kernel updated
[ -f /var/run/reboot-required ] && sudo reboot
```

---

## Quick Reference Card

### Essential Commands

```bash
# Status
curl -s http://localhost:5005/ -d '{"method":"server_info"}' | python3 -m json.tool

# Restart validator
cd /opt/postfiatd && docker compose restart

# View logs
docker logs -f postfiatd --tail 100

# Backup keys
cp /opt/postfiatd/validator-keys.json ~/validator-keys-$(date +%Y%m%d).json

# Check peers
curl -s http://localhost:5005/ -d '{"method":"peers"}' | python3 -c "import sys,json;print(len(json.load(sys.stdin)['result']['peers']),'peers')"
```

### Key Paths

| Path | Purpose |
|------|---------|
| `/opt/postfiatd/` | Validator home |
| `/opt/postfiatd/validator-keys.json` | **CRITICAL - BACKUP** |
| `/opt/postfiatd/postfiatd.cfg` | Configuration |
| `/opt/pf-monitor/` | Monitoring stack |
| `http://localhost:3000` | Grafana |
| `http://localhost:9090` | Prometheus |

### Expected States

| State | Meaning | Action |
|-------|---------|--------|
| `disconnected` | No peers | Check network/firewall |
| `connected` | Finding peers | Wait |
| `syncing` | Catching up | Wait (10-30 min) |
| `tracking` | Following chain | Wait |
| `full` | Synced, not proposing | Normal for non-UNL |
| `proposing` | Active validator | You're on the UNL! |

### Support

- **Discord:** https://discord.gg/postfiat
- **Docs:** https://docs.postfiat.org
- **GitHub:** https://github.com/postfiat

---

*Superstructure Validator Onboarding Checklist v1.0*  
*Published by Permanent Upper Class validator operation.*
