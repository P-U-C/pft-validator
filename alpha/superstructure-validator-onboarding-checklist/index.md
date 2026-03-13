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

## OPSEC Guidelines

**What stays PUBLIC (this guide):**
- Hardware requirements and VPS recommendations
- Software dependencies and versions
- General deployment flow and commands
- Monitoring architecture and alert categories
- Troubleshooting procedures

**What stays PRIVATE (your TaskNode profile / local notes):**
- Your actual server IP addresses
- Discord webhook URLs
- Grafana/admin passwords
- Validator key file contents
- Your domain's specific attestation string
- Any custom firewall rules or VPN configurations

**Best practices:**
- Never commit `validator-keys.json` to any repository
- Use environment variables for secrets, not hardcoded values
- Store webhook URLs in password manager, not plain text
- Keep a separate offline backup of validator identity (USB, paper)
- Use your TaskNode Private Profile for deployment-specific configs

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
| 2559 | Inbound | TCP | Peer-to-peer (optional but recommended) |
| 5005 | Local only | HTTP | Admin RPC |
| 6005 | Inbound | WSS | WebSocket API |
| 22 | Inbound | TCP | SSH (your access) |

**Pre-flight network check:**
```bash
#!/bin/bash
echo "=== Network Pre-flight ==="
echo "Public IP: $(curl -4 -s ifconfig.me)"
nc -z -w5 postfiat.org 443 && echo "✅ Outbound HTTPS OK" || echo "❌ Outbound blocked"
```

**Firewall rules (if using UFW):**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 2559/tcp  # Peer-to-peer
sudo ufw allow 6005/tcp  # WebSocket
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
- **10 XRP minimum** — XRPL account reserve
- **Additional XRP** — for transaction fees

Funding sources:
- Transfer from exchange
- Purchase via onramp (MoonPay, etc.)

### 2.3 Configure Trust Line

Post Fiat tokens (PFT) require a trust line to the issuer:

```bash
# Using xrpl-py
python3 << 'EOF'
from xrpl.clients import JsonRpcClient
from xrpl.wallet import Wallet
from xrpl.models.transactions import TrustSet
from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.transaction import submit_and_wait

client = JsonRpcClient("https://xrplcluster.com")
wallet = Wallet.from_seed("YOUR_SEED_HERE")  # Replace with your seed

trust_set = TrustSet(
    account=wallet.classic_address,
    limit_amount=IssuedCurrencyAmount(
        currency="PFT",
        issuer="rnQUEEg8yyjrwk9FhyXpKavHyCRJM9BDMW",  # PFT issuer
        value="1000000000"
    )
)

response = submit_and_wait(trust_set, client, wallet)
print("Trust line result:", response.result["meta"]["TransactionResult"])
EOF
```

### 2.4 Domain Ownership

You need a domain you control for validator verification. The one-click deploy will ask for this.

**Requirements:**
- Domain with HTTPS support
- Ability to host files at `/.well-known/xrp-ledger.toml`
- DNS control (to point to GitHub Pages or your own hosting)

**Easiest option:** GitHub Pages (free, HTTPS included)

### 2.5 Identity Checklist

Before running one-click deploy, confirm:

- [ ] XRPL wallet created
- [ ] Wallet funded with 10+ XRP
- [ ] Trust line configured for PFT token
- [ ] Domain owned and accessible
- [ ] DNS credentials available

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

[METADATA]
domain = "validator.yourdomain.com"
network = "postfiat"
---

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

### 5.1 Port Conflicts

**Symptom:** Deploy fails with "port already in use" or container won't start.

**Diagnosis:**
```bash
# Check what's using the ports
sudo lsof -i :2559
sudo lsof -i :5005
sudo lsof -i :6005
sudo lsof -i :3000
sudo lsof -i :9090
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
for port in 2559 5005 6005 3000 9090 9093; do
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
nc -zv seed.postfiat.org 2559
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
