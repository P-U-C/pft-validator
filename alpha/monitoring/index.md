---
layout: default
title: Validator Monitoring Stack
date: 2026-03-03
category: validator-infrastructure
status: published
---

# Post Fiat Validator Monitoring Stack

> Prometheus + Grafana + Alertmanager monitoring for Post Fiat Network validators.

**Repository:** [P-U-C/pf-monitor](https://github.com/P-U-C/pf-monitor)

---

## Overview

Production-grade monitoring stack for Post Fiat validators with:

- **Custom Prometheus exporter** for postfiatd JSON-RPC metrics
- **25+ pre-configured alert rules** across consensus, infrastructure, and config integrity
- **Pre-built Grafana dashboard** with 6 panel rows
- **Discord/Slack/PagerDuty alerting** with severity routing
- **Split architecture option** — monitor survives if validator dies

---

## Quick Start

```bash
git clone https://github.com/P-U-C/pf-monitor && cd pf-monitor
chmod +x setup.sh
./setup.sh local
```

The setup script prompts for your RPC URL, Discord webhook, and passwords interactively.

---

## Deployment Options

### Option A: All on One Machine (Simple)

Everything runs on the validator host. Quick to set up, but if the machine goes down you won't get an alert.

```bash
./setup.sh local
```

### Option B: Split Across Two Machines (Recommended)

Exporters run on the validator. Prometheus/Grafana/Alertmanager run on a separate machine (Proxmox LXC, Oracle VPS, etc). If the validator dies, the monitor stays up and alerts fire.

**On the validator host:**
```bash
./setup.sh split-validator
```

**On the monitor host:**
```bash
./setup.sh split-monitor
```

---

## What's Monitored

### Consensus
- Node reachable
- Server state = full
- Ledger advancing
- Ledger age
- Peer count (total, inbound, outbound)
- I/O latency
- Convergence time
- Load factor
- Job queue overflow

### Infrastructure
- CPU, RAM, disk, swap
- Network errors
- Disk fill prediction
- Container status
- OOM events
- Restart loops
- CPU throttling

### Post Fiat Specific
- Validator key files exist/unchanged
- Token presence
- Quorum
- Fee spikes
- Transaction queue
- Amendment votes

---

## Architecture

```
 Monitor host                     Validator host
┌──────────────────────┐         ┌──────────────────────────┐
│ Prometheus (:9090)   │── scrapes ──→ postfiatd_exporter (:9750)
│ Grafana (:3000)      │              node_exporter (:9100)
│ Alertmanager (:9093) │              │
│         ▼            │              │ postfiatd (your node)
│   Discord / Slack    │              └──────────────────────────┘
└──────────────────────┘
```

In local mode, everything runs on the validator host.

---

## Alert Severity Routing

| Severity | Destination | Timing |
|----------|-------------|--------|
| Critical | Discord + PagerDuty | Immediate, repeat every 30m |
| Warning | Discord | 5m group wait, repeat every 4h |
| Info | Discord | 15m group wait, repeat every 24h |

Critical alerts automatically suppress matching warnings.

---

## Grafana Dashboard

Pre-loaded at `http://<host>:3000` with panels for:

- **Operator Status** — up/down, server state, peers, ledger age, I/O latency, uptime, quorum
- **Consensus** — ledger sequence, age, convergence, load factor, proposers
- **Infrastructure** — CPU, RAM, disk with threshold lines, network/disk I/O, load
- **Container** — status, uptime, restarts, OOM, CPU%, memory, network
- **Governance** — amendments enabled/supported/vetoed, fee levels, tx queue
- **Config Integrity** — file existence, size tracking

---

## Metrics Exposed

~50 unique metrics covering:

- Exporter health (scrape duration, errors, up/down)
- Server state, uptime, state accounting
- Ledger (sequence, age, hash, base fee, reserves)
- Peers (total, inbound/outbound, disconnects)
- Consensus (load factor, I/O latency, quorum, convergence, proposers)
- Fees (queue size, ledger size, min/median/open_ledger drops)
- Governance (amendment counts, per-amendment status)
- Container (running, CPU%, memory, network, restarts, OOM)
- File integrity (exists, size, mtime, SHA-256 hash)

---

## Verify It's Working

```bash
# Check all containers are running
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep pf-

# Check exporter is scraping postfiatd
curl -s http://localhost:9750/metrics | head -20

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import sys,json
targets=json.load(sys.stdin)['data']['activeTargets']
for t in targets:
    print(f\"{t['labels'].get('job','?'):25s} {t['health']:10s}\")
"

# Check what's firing
curl -s 'localhost:9090/api/v1/alerts' | python3 -c "
import sys, json
alerts = json.load(sys.stdin).get('data', {}).get('alerts', [])
if not alerts:
    print('No alerts firing')
else:
    for a in alerts:
        print(f\"{a['labels'].get('severity','?'):8s} {a['labels'].get('alertname','')}\")
"
```

---

## Requirements

- Docker + Docker Compose v2
- Network access from monitor host to validator on ports 9750 and 9100
- A Discord webhook URL for alerts (optional but recommended)

---

## Repository

Full source, documentation, and issue tracking:

**[github.com/P-U-C/pf-monitor](https://github.com/P-U-C/pf-monitor)**

---

*Published by Permanent Upper Class validator operation.*
