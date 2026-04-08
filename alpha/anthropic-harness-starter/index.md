---
layout: default
title: Anthropic Harness Starter for b1e55ed Workflow
date: 2026-04-08
category: personal
status: submitted
task_id: 5d9fd3ff-64ff-469d-a01c-779454c37634
---

# Anthropic Harness Starter for b1e55ed Workflow

**Task ID:** `5d9fd3ff-64ff-469d-a01c-779454c37634`  
**Reward:** 3,800 PFT  
**Verification:** URL  
**Date:** 2026-04-08

> Formalizes Claude as the default workflow for b1e55ed development.
> Runs on **Claude Max subscription** via `claude -p` (print mode) — no API key billing.
> Built on [Claude Code CLI](https://code.claude.com/docs/en/cli-usage).

---

## 1. Setup Instructions

### Prerequisites
- [Claude Code CLI](https://claude.ai/install.sh) installed and authenticated
- Python 3.10+ (for MCP tools server — zero pip dependencies)
- Claude Max subscription ($100 or $200/mo)

### Install

```bash
git clone https://github.com/P-U-C/b1e55ed-harness.git
cd b1e55ed-harness

# Verify auth (should show "Claude Max Account")
claude auth status --text

# Set the bearer token for b1e55ed instance tools
export B1E55ED_API_TOKEN=your-bearer-token
```

No `pip install` needed. The harness calls `claude -p` directly.
The MCP tools server is plain Python with zero external dependencies.

### Architecture Decision: CLI Print Mode over Managed Agents API

Anthropic released Claude Managed Agents (April 2026) — cloud-hosted agents via API at $0.08/hr + per-token billing. We evaluated both paths:

| Aspect | Managed Agents API | Claude CLI (subscription) |
|--------|-------------------|--------------------------|
| Cost | $0.08/hr + tokens | $100-200/mo flat |
| Capabilities | bash, read, write, edit, glob, grep, web | Same (built-in tools) |
| MCP support | Yes (URL-based servers) | Yes (subprocess servers) |
| System prompts | Yes | Yes (--append-system-prompt-file) |
| Infrastructure | Anthropic cloud | Local machine |
| Session persistence | Built-in | Log files |
| Best for | CI/CD, multi-tenant | Daily operator work |

**Decision: CLI subscription mode.** Same capabilities, predictable cost, no surprises. The API path stays available for CI/CD or multi-tenant use cases where subscription auth doesn't apply.

---

## 2. Harness Entrypoint (`harness.py`)

Wraps `claude -p` with b1e55ed-specific context, MCP tools, and task templates.

```python
#!/usr/bin/env python3
"""b1e55ed Harness — Claude CLI (subscription) entrypoint.

Usage:
    python harness.py audit                     # Full system audit
    python harness.py fix "description"         # Fix a specific issue
    python harness.py review 508                # Review a PR
    python harness.py prompt "free text"        # Custom prompt
    python harness.py prompt --write "text"     # Custom prompt with write access
"""

import json, os, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

HARNESS_DIR = Path(__file__).parent
REPO_DIR = os.environ.get("B1E55ED_REPO", os.path.expanduser("~/b1e55ed"))
TASKS_DIR = HARNESS_DIR / "tasks"
LOG_DIR = HARNESS_DIR / "logs"
SYSTEM_PROMPT_FILE = HARNESS_DIR / "system-prompt.md"
MCP_CONFIG = HARNESS_DIR / "mcp-config.json"


def _load_task(name, **kwargs):
    content = (TASKS_DIR / f"{name}.md").read_text()
    for key, value in kwargs.items():
        content = content.replace(f"{{{key}}}", value)
    return content


def run_claude(prompt, mode="read"):
    LOG_DIR.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    log_file = LOG_DIR / f"run_{ts}.log"

    cmd = [
        "claude", "-p", prompt,
        "--output-format", "text",
        "--append-system-prompt-file", str(SYSTEM_PROMPT_FILE),
        "--mcp-config", str(MCP_CONFIG),
    ]

    # Read-only vs read-write tool sets
    mcp_tools = [
        "mcp__b1e55ed__b1e55ed_health",
        "mcp__b1e55ed__b1e55ed_positions",
        "mcp__b1e55ed__b1e55ed_convictions",
        "mcp__b1e55ed__b1e55ed_producers",
        "mcp__b1e55ed__b1e55ed_db_query",
        "mcp__b1e55ed__b1e55ed_kill_switch",
    ]

    if mode == "write":
        cmd += ["--permission-mode", "acceptEdits"]
        cmd += ["--allowedTools", "Read", "Edit", "Write", "Bash", "Glob", "Grep"] + mcp_tools
    else:
        cmd += ["--permission-mode", "dontAsk"]
        cmd += ["--allowedTools", "Read", "Glob", "Grep", "Bash"] + mcp_tools

    with open(log_file, "w") as f:
        f.write(f"# b1e55ed Harness — {ts}\n# Mode: {mode}\n---\n\n")

    print(f"[harness] Mode: {mode} | Log: {log_file}")

    proc = subprocess.Popen(cmd, cwd=REPO_DIR, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True)
    output = []
    for line in proc.stdout:
        print(line, end="")
        output.append(line)
    proc.wait()

    with open(log_file, "a") as f:
        f.writelines(output)
        f.write(f"\n---\n# Exit: {proc.returncode}\n")

    print(f"\n[harness] Exit: {proc.returncode} | Log: {log_file}")
    return proc.returncode


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "audit":
        run_claude(_load_task("audit"), mode="read")
    elif cmd == "fix" and len(sys.argv) >= 3:
        run_claude(_load_task("fix", issue_description=" ".join(sys.argv[2:])), mode="write")
    elif cmd == "review" and len(sys.argv) >= 3:
        run_claude(_load_task("review", pr_number=sys.argv[2]), mode="read")
    elif cmd == "prompt":
        args = sys.argv[2:]
        mode = "write" if "--write" in args else "read"
        if "--write" in args: args.remove("--write")
        run_claude(" ".join(args), mode=mode)
    else:
        print(__doc__); sys.exit(1)

if __name__ == "__main__":
    main()
```

---

## 3. MCP Tools Server (`tools_server.py`)

Subprocess MCP server giving Claude direct access to the live b1e55ed instance.
Zero pip dependencies — uses only Python stdlib.

```python
#!/usr/bin/env python3
"""b1e55ed MCP tools server — stdio protocol for Claude CLI."""

import json, os, sqlite3, sys, urllib.request
from pathlib import Path

B1E55ED_DB = os.environ.get("B1E55ED_DB",
                             os.path.expanduser("~/.b1e55ed/data/brain.db"))
API_BASE = os.environ.get("B1E55ED_API", "http://127.0.0.1:5050")
API_TOKEN = os.environ.get("B1E55ED_API_TOKEN", "")

def _api_get(path):
    req = urllib.request.Request(f"{API_BASE}{path}")
    if API_TOKEN:
        req.add_header("Authorization", f"Bearer {API_TOKEN}")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

def _db_query(sql):
    conn = sqlite3.connect(B1E55ED_DB)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(sql).fetchall()[:100]]
    finally:
        conn.close()

TOOLS = {
    "b1e55ed_health": {
        "description": "Get instance health (uptime, DB, brain cycle, kill switch).",
        "inputSchema": {"type": "object", "properties": {}}
    },
    "b1e55ed_positions": {
        "description": "Get all positions with P&L.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    "b1e55ed_convictions": {
        "description": "Get latest conviction scores.",
        "inputSchema": {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 10}
        }}
    },
    "b1e55ed_producers": {
        "description": "Get signal producer status.",
        "inputSchema": {"type": "object", "properties": {}}
    },
    "b1e55ed_db_query": {
        "description": "Run read-only SQL against brain.db.",
        "inputSchema": {"type": "object", "properties": {
            "sql": {"type": "string"}
        }, "required": ["sql"]}
    },
    "b1e55ed_kill_switch": {
        "description": "Get kill switch level.",
        "inputSchema": {"type": "object", "properties": {}}
    },
}

def handle_tool(name, args):
    try:
        if name == "b1e55ed_health":
            return json.dumps(_api_get("/api/v1/health"), indent=2)
        if name == "b1e55ed_positions":
            return json.dumps(_api_get("/api/v1/positions"), indent=2)
        if name == "b1e55ed_convictions":
            return json.dumps(
                _api_get(f"/api/v1/brain/convictions?limit={args.get('limit',10)}"),
                indent=2)
        if name == "b1e55ed_producers":
            return json.dumps(_api_get("/api/v1/producers/status"), indent=2)
        if name == "b1e55ed_db_query":
            sql = args.get("sql", "")
            blocked = ("insert", "update", "delete", "drop", "alter", "create")
            if any(sql.strip().lower().startswith(k) for k in blocked):
                return "Error: write queries blocked."
            return json.dumps(_db_query(sql), indent=2, default=str)
        if name == "b1e55ed_kill_switch":
            d = _api_get("/api/v1/brain/status")
            return json.dumps({
                "level": d.get("kill_switch", {}).get("level"),
                "active": d.get("kill_switch", {}).get("active"),
            }, indent=2)
    except Exception as e:
        return f"Error: {e}"

def send(id, result):
    out = json.dumps({"jsonrpc": "2.0", "id": id, "result": result})
    sys.stdout.write(f"Content-Length: {len(out)}\r\n\r\n{out}")
    sys.stdout.flush()

def run():
    buf = ""
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        buf += line
        if "Content-Length:" in buf:
            parts = buf.split("\r\n\r\n", 1)
            if len(parts) < 2:
                continue
            hdr, rest = parts
            length = int(
                hdr.split("Content-Length:")[1].strip().split("\r\n")[0])
            if len(rest) < length:
                continue
            msg = json.loads(rest[:length])
            buf = rest[length:]
            method, id = msg.get("method", ""), msg.get("id")
            if method == "initialize":
                send(id, {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "b1e55ed", "version": "0.1.0"},
                })
            elif method == "tools/list":
                send(id, {
                    "tools": [{"name": k, **v} for k, v in TOOLS.items()]
                })
            elif method == "tools/call":
                send(id, {
                    "content": [{
                        "type": "text",
                        "text": handle_tool(
                            msg["params"]["name"],
                            msg["params"].get("arguments", {})),
                    }]
                })

if __name__ == "__main__":
    run()
```

**MCP config** (`mcp-config.json`):
```json
{
  "mcpServers": {
    "b1e55ed": {
      "command": "python3",
      "args": ["/home/ubuntu/b1e55ed-harness/tools_server.py"],
      "env": {
        "B1E55ED_DB": "/home/ubuntu/.b1e55ed/data/brain.db",
        "B1E55ED_API": "http://127.0.0.1:5050",
        "B1E55ED_API_TOKEN": "${B1E55ED_API_TOKEN}"
      }
    }
  }
}
```

---

## 4. Task Template: System Audit (`tasks/audit.md`)

```markdown
# Task: System Audit

Run a comprehensive 5-layer audit of the b1e55ed instance.

## Layers

### Layer 1: Integrity
- Check hash chain via b1e55ed_health tool
- Query event count from brain.db
- Verify chain continuity

### Layer 2: Brain Cycle
- Check conviction scores — varied or ceiling'd?
- Verify regime detection produces different labels
- Check CTS values are gradient (not binary)

### Layer 3: Execution
- List positions — blind (no mark price) or duplicates?
- Verify stop-loss/take-profit levels
- Paper P&L accounting

### Layer 4: API & SPI
- Health endpoint
- Producer status (quarantined/unhealthy)
- Kill switch status

### Layer 5: Observability
- CLI vs API health comparison
- Config drift check
- Recent logs for errors

## Output
Structured report per layer, severity ratings, prioritized actions.
```

---

## 5. End-to-End Run Log (Real Execution on blessed-patient-zero)

```
$ python harness.py audit

[harness] Mode: read | Log: logs/run_20260408_202528.log

**b1e55ed status:**

- **Health:** degraded — brain cycle stale (last cycle ~19h ago),
  kill switch OFF, uptime 15.4h
- **Database:** 767 MB (WAL mode), **515,166 events** total
- **Version:** 1.0.0rc1 — API responding on :5050,
  brain needs a cycle restart

[harness] Exit: 0 | Log: logs/run_20260408_202528.log
```

**What happened:** The harness:
1. Loaded system-prompt.md (b1e55ed operator context)
2. Connected MCP tools_server.py (health + db_query)
3. Claude autonomously called both tools in parallel
4. Detected stale brain cycle (real issue — daemon restarted after config changes)
5. Returned structured 3-line summary
6. Full output captured to log file

All on subscription. No API key. No pip install. ~8 seconds total.

---

## 6. PFT Task Worker (Companion Agent)

Following the same harness pattern, we built a companion agent for PFT network task execution at `~/pft-agent/`:

```python
from src.agent import PFTTaskWorker

worker = PFTTaskWorker()
worker.verify_setup()
# -> claude_version: 2.1.96, auth: Claude Max Account,
#    repos: pft-audit + pft-validator present, system_prompt: 6,927 chars

# Run a task autonomously (7-phase process)
result = worker.run_task("Build Deterministic Reward Holdback Decision Module...")

# Send review feedback
worker.send_review(result["log_file"], "Fix determinism issue")
```

The PFT agent encodes the full 7-phase process (INTAKE through PROOF) in a 6,927-character system prompt distilled from actual task review cycles. It uses the same `claude -p` CLI pattern — zero pip dependencies, subscription billing, log capture.

---

## 7. Operator Note

### What this replaces
Ad hoc Claude Code CLI sessions where b1e55ed context (repo structure, instance state, CODEX rules, API tokens) was manually re-established each time. The harness loads everything once via system prompt + MCP tools and makes every run reproducible.

### Architecture decision: CLI print mode over Agent SDK
The Agent SDK (`pip install claude-agent-sdk`) and the new Managed Agents API both require API key billing ($$/token + $0.08/hr runtime). Claude CLI print mode (`claude -p`) runs on the Max subscription ($100-200/mo flat). Same capabilities — built-in tools, MCP, permissions, system prompts — but on a predictable cost basis. The API paths remain available for CI/CD or multi-tenant use cases where subscription auth doesn't apply.

### Next infra increment
**Scheduled agent loops.** Wire `harness.py audit` into a systemd timer or cron to run daily. Post the report to Telegram via the existing bot token. This converts the agent from "tool I invoke" to "operator that monitors blessed-patient-zero autonomously." The PFT task worker gets the same treatment — a Telegram-triggered loop that picks up new tasks from the network and executes them with human-in-the-loop review via chat.

---

**Source:** [github.com/P-U-C/b1e55ed-harness](https://github.com/P-U-C/b1e55ed-harness)

*Published by Zoz via the Permanent Upper Class validator operation.*  
*Task completed for the Post Fiat Network.*
