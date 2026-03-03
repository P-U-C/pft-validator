---
layout: default
title: Onboarding Guide for Post Fiat Validators
date: 2026-03-03
category: validator-infrastructure
status: draft
task_url: https://tasknode.postfiat.org/tasks/44150e45-81e6-421e-a8ec-5236fb42237a/forensics
reward: 2000 PFT
---

# Onboarding Guide for Post Fiat Validators

> A practical guide for running a Post Fiat Network validator — from VPS setup to domain verification.

---

## What is Post Fiat?

Post Fiat is an L1 blockchain that uses AI-scored validator selection on top of XRP's consensus protocol. Validators earn rewards based on three factors:

1. **Entity Credibility** — LLM-scored based on your verified domain
2. **Transaction Quality** — On-chain activity and memo content
3. **Objective Metrics** — Uptime, volume, network topology

The top 50 validators by monthly economic activity share in the reward pool.

**This guide covers:** Setting up a validator node, verifying your domain, and maintaining uptime.

---

## Hardware Requirements

### ⚠️ 8 GB RAM — Bare Minimum Viable

| Spec | Value |
|------|-------|
| CPU | 4-6 vCPU |
| RAM | 8 GB |
| Storage | 200 GB NVMe SSD |
| Network | 1 Gbps |
| OS | Ubuntu 24.04 LTS |
| Architecture | x86_64 only |

- Will sync and validate under normal conditions
- Risk of memory pressure during spikes
- Not recommended for long-term operation

### ✅ 16 GB RAM — Recommended Minimum

| Spec | Value |
|------|-------|
| CPU | 8 vCPU |
| RAM | 16 GB |
| Storage | 250 GB NVMe SSD |
| Network | 1 Gbps |
| OS | Ubuntu 24.04 LTS |
| Architecture | x86_64 only |

- No swap usage
- Stable ledger replay
- Headroom for network growth
- **This is the practical floor for non-enterprise operators**

### 💰 VPS Recommendations

| Provider | Instance | Cost | Notes |
|----------|----------|------|-------|
| **Vultr** | High Frequency | ~$48/mo | Crypto-friendly, reliable |
| **DigitalOcean** | Regular Droplet 8GB | ~$48/mo | Good support, stable |
| Hetzner | CPX31 | ~€24/mo | ⚠️ See caveat below |
| AWS EC2 | t3.xlarge | Variable | Enterprise option |

**⚠️ Hetzner Caveat:**  
Hetzner offers the best price/performance, but their Terms of Service may restrict cryptocurrency-related operations. Some operators have reported account terminations. If you use Hetzner:
- Don't advertise your validator publicly on their infrastructure
- Have a migration plan ready
- Consider it for testing, not long-term production

**Avoid:**
- ARM instances (unless you know what you're doing)
- Network-attached block storage (AWS EBS)
- Shared/burst CPU instances

---

## Prerequisites

Before starting, you need:

1. **A VPS or server** meeting the hardware requirements above
2. **A domain name** you control (for validator verification)
3. **Basic Linux command-line familiarity**

### Domain Setup (Do This First)

You'll need to host a verification file at:
```
https://yourdomain.com/.well-known/xrp-ledger.toml
```

The easiest method is GitHub Pages (free). We'll set this up in the Domain Verification section.

---

## Installation

### Step 1: SSH into your server

```bash
ssh root@your-server-ip
```

### Step 2: Create a dedicated user

```bash
adduser --disabled-password --gecos "" postfiat
echo "postfiat ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/postfiat
su - postfiat
```

### Step 3: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
```

### Step 4: Clone the repository

```bash
sudo mkdir -p /opt/postfiatd
sudo chown postfiat:postfiat /opt/postfiatd
cd /opt/postfiatd

# Download compose file
curl -fsSL "https://raw.githubusercontent.com/postfiatorg/postfiatd/main/scripts/docker-compose-validator.yml" -o docker-compose.yml
```

### Step 5: Download configuration

```bash
curl -fsSL "https://raw.githubusercontent.com/postfiatorg/postfiatd/main/cfg/postfiatd.cfg" -o postfiatd.cfg
```

### Step 6: Generate validator keys

```bash
# Pull the image first
docker pull agtipft/postfiatd:devnet-light-latest

# Generate keys
docker run --rm -v /opt/postfiatd:/data agtipft/postfiatd:devnet-light-latest \
  validator-keys create_keys --keyfile /data/validator-keys.json

# Generate token
docker run --rm -v /opt/postfiatd:/data agtipft/postfiatd:devnet-light-latest \
  validator-keys create_token --keyfile /data/validator-keys.json > /opt/postfiatd/validator-token.txt
```

**⚠️ CRITICAL:** Back up `/opt/postfiatd/validator-keys.json` immediately. Store it offline. If you lose this file, you lose your validator identity permanently.

### Step 7: Configure the validator

Edit `/opt/postfiatd/postfiatd.cfg`:

```bash
nano /opt/postfiatd/postfiatd.cfg
```

Add your validator token (the entire base64 string on one line):
```ini
[validator_token]
eyJtYW5pZmVzdCI6IkpBQUFBQUZ4SWUw...YOUR_FULL_TOKEN_HERE...
```

Set your domain (we'll verify this later):
```ini
[server_domain]
yourdomain.com
```

### Step 8: Create promtail config (if using logging)

```bash
cat > /opt/postfiatd/promtail-config.yml << 'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0
positions:
  filename: /tmp/positions.yaml
clients:
  - url: http://localhost:3100/loki/api/v1/push
scrape_configs:
  - job_name: postfiatd
    static_configs:
      - targets:
          - localhost
        labels:
          job: postfiatd
          __path__: /var/log/postfiatd/*.log
EOF
```

### Step 9: Start the validator

```bash
cd /opt/postfiatd
docker compose up -d
```

### Step 10: Verify it's running

Wait 30 seconds, then:

```bash
curl -s -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"method":"server_info","params":[{}]}' | python3 -c "
import sys,json
d=json.load(sys.stdin)['result']['info']
print('State:', d.get('server_state'))
print('Peers:', d.get('peers'))
print('Domain:', d.get('server_domain','NOT SET'))
"
```

Expected output:
```
State: full
Peers: 10
Domain: yourdomain.com
```

---

## Domain Verification

For your validator to appear on the explorer with your domain, you need:
1. A TOML file hosted over HTTPS
2. An attestation (cryptographic signature)
3. The validator manifest to include your domain

### Step 1: Get your validator public key

```bash
cat /opt/postfiatd/validator-keys.json | python3 -c "
import sys,json
print(json.load(sys.stdin)['public_key'])
"
```

### Step 2: Set domain and generate attestation

```bash
# Copy keys into container
docker cp /opt/postfiatd/validator-keys.json postfiatd:/tmp/validator-keys.json

# Set domain
docker exec postfiatd validator-keys --keyfile /tmp/validator-keys.json set_domain yourdomain.com
```

This outputs:
- An **attestation string** (save this)
- A **new validator token** (you must update your config with this)

### Step 3: Update your config with the new token

Replace the old token in `/opt/postfiatd/postfiatd.cfg` with the new one from the output above.

### Step 4: Restart the validator

```bash
cd /opt/postfiatd
docker compose down
docker compose up -d
```

### Step 5: Host the TOML file

#### Using GitHub Pages (Recommended)

1. Create a new GitHub repository (e.g., `validator-toml`)

2. Add `_config.yml` to the root:
```yaml
include:
  - .well-known
```

3. Add `.well-known/xrp-ledger.toml`:
```toml
[[VALIDATORS]]
public_key = "YOUR_VALIDATOR_PUBLIC_KEY"
attestation = "YOUR_ATTESTATION_STRING"
network = "main"
owner_country = "YOUR_COUNTRY_CODE"
server_country = "YOUR_SERVER_COUNTRY_CODE"

[METADATA]
domain = "yourdomain.com"
network = "postfiat"
```

4. Enable GitHub Pages:
   - Repository Settings → Pages → Deploy from main branch

5. Set custom domain:
   - Settings → Pages → Custom domain → `yourdomain.com`

6. Configure DNS (at your registrar):
   
   For apex domain:
   | Type | Name | Value |
   |------|------|-------|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |

   For subdomain:
   | Type | Name | Value |
   |------|------|-------|
   | CNAME | validator | yourusername.github.io |

7. Wait for HTTPS (15-60 minutes)

8. Verify:
```bash
curl -s https://yourdomain.com/.well-known/xrp-ledger.toml
```

---

## Monitoring & Maintenance

### Full Monitoring Stack (Recommended)

For production validators, use the dedicated monitoring stack:

**[P-U-C/pf-monitor](https://github.com/P-U-C/pf-monitor)** — Prometheus + Grafana + Alertmanager

Features:
- Custom exporter for postfiatd JSON-RPC metrics
- 25+ pre-configured alert rules
- Pre-built Grafana dashboard
- Discord/Slack/PagerDuty alerting
- Split architecture option (monitor survives if validator dies)

```bash
git clone https://github.com/P-U-C/pf-monitor && cd pf-monitor
chmod +x setup.sh
./setup.sh local  # or ./setup.sh split-validator + split-monitor
```

### Quick Health Check (No Stack)

```bash
#!/bin/bash
curl -s -X POST http://localhost:5005/ \
  -H "Content-Type: application/json" \
  -d '{"method":"server_info","params":[{}]}' | python3 -c "
import sys,json
d=json.load(sys.stdin)['result']['info']
print('State:', d.get('server_state'))
print('Peers:', d.get('peers'))
print('Ledger:', d.get('validated_ledger',{}).get('seq','syncing'))
print('Uptime:', d.get('uptime'), 'seconds')
"
```

### Peer Count Check

```bash
docker exec postfiatd curl -s -X POST http://127.0.0.1:5005 \
  -d '{"method":"peers"}' | python3 -c "
import sys,json
peers=json.load(sys.stdin)['result']['peers']
inbound = sum(1 for p in peers if p.get('inbound'))
outbound = len(peers) - inbound
print(f'Total: {len(peers)} | Inbound: {inbound} | Outbound: {outbound}')
"
```

### Auto-Restart on Reboot

1. Enable Docker to start on boot:
```bash
sudo systemctl enable docker
```

2. Add restart policy to docker-compose.yml:
```yaml
services:
  postfiatd:
    restart: unless-stopped
```

### View Logs

```bash
cd /opt/postfiatd
docker compose logs -f postfiatd
```

### Check Validator Identity in Logs

```bash
docker logs postfiatd 2>&1 | grep -i "validator identity"
```

---

## Troubleshooting

### `pubkey_validator: NONE` in server_info

**This is normal if you're not on the UNL.** The field only shows when the node is in `proposing` mode.

Check the logs instead:
```bash
docker logs postfiatd 2>&1 | grep -i "validator identity"
```

If you see `Validator identity: nXXX...`, your key is loaded correctly.

### Token not loading / Token truncated

The validator token must be on a **single line** with no line breaks.

Check what the container sees:
```bash
docker exec postfiatd cat /etc/postfiatd/postfiatd.cfg | grep -A2 'validator_token'
```

If truncated, fix the config and restart:
```bash
docker compose down
docker compose up -d --force-recreate
```

### promtail mount error: "not a directory"

Docker created a directory instead of expecting a file.

```bash
rm -rf /opt/postfiatd/promtail-config.yml
# Then recreate the file (see Step 8 above)
```

### Domain not showing on explorer

1. Verify TOML is accessible over HTTPS:
```bash
curl -s https://yourdomain.com/.well-known/xrp-ledger.toml
```

2. Verify attestation is present in TOML

3. Verify validator config has the domain:
```bash
grep -A1 'server_domain' /opt/postfiatd/postfiatd.cfg
```

4. Verify you updated the token after `set_domain`

### GitHub Pages: `.well-known` returns 404

Add `_config.yml` to your repo root:
```yaml
include:
  - .well-known
```

### DNS changes not taking effect

- DNS propagation can take up to an hour
- Check with: `dig @8.8.8.8 yourdomain.com A +short`
- GoDaddy may have parking/forwarding enabled that injects extra records

---

## Server States Explained

| State | Meaning |
|-------|---------|
| `disconnected` | No peers connected |
| `connected` | Has peers, starting to sync |
| `syncing` | Catching up to network |
| `tracking` | Following network, not validating |
| `full` | Synced, but not on UNL (not proposing) |
| `proposing` | Actively validating (on UNL) |

Most non-UNL validators will stay in `full` state. This is normal and expected.

---

## Earning Rewards

Simply running a validator is not enough to earn rewards. Post Fiat requires active participation:

1. **Join the Discord:** https://discord.com/invite/U6HjgDSmhR
2. **Install wallet tools:** Follow the guide at https://goodalexander.com/posts/post_fiat_install/
3. **Participate in tasks:** Request tasks, submit for verification, earn rewards
4. **Maintain uptime:** 99.9% uptime contributes to your score

Rewards are distributed monthly to the top 50 validators by economic activity score.

---

## Home Lab Setup (Optional)

Running a validator from home adds complexity:

- **NAT traversal:** You may not have a public IP
- **VPN considerations:** Commercial VPNs can interfere with peer connections
- **Port forwarding:** Requires router configuration

### Key Points

- **Outbound-only is acceptable:** 10 outbound peers is enough for testnet
- **WireGuard relay is complex:** Policy routing through a VPS relay has many failure modes
- **LXC containers:** Officially unsupported by Post Fiat, though they work on self-managed Proxmox with privileged + nesting

If you're behind a commercial VPN and need inbound peers, consider renting a small VPS instead — it's simpler and more reliable.

---

## Quick Reference

### Useful Commands

```bash
# Check status
curl -s -X POST http://localhost:5005/ -H "Content-Type: application/json" \
  -d '{"method":"server_info","params":[{}]}' | python3 -m json.tool

# Restart
cd /opt/postfiatd && docker compose restart

# Stop
cd /opt/postfiatd && docker compose down

# Logs
cd /opt/postfiatd && docker compose logs -f postfiatd

# Backup keys
cp /opt/postfiatd/validator-keys.json ~/validator-keys-backup.json
```

### Important Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 2559 | TCP | Peer-to-peer |
| 5005 | HTTP | Admin RPC (localhost only) |
| 6005 | WSS | WebSocket (public) |
| 6006 | HTTP | Admin (localhost only) |

### Key Files

| File | Purpose |
|------|---------|
| `/opt/postfiatd/validator-keys.json` | Validator identity (BACK THIS UP!) |
| `/opt/postfiatd/postfiatd.cfg` | Node configuration |
| `/opt/postfiatd/docker-compose.yml` | Container orchestration |

---

*Published by Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
