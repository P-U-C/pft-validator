# pft-validator

Public static site served at **[pft.permanentupperclass.com](https://pft.permanentupperclass.com)**.
GitHub Pages off this repo's `main` branch.

This is the "front desk" for the P-U-C validator node and a small set of
public dashboards / docs / alpha submissions. Most pages are static HTML
with a single `fetch()` against a JSON feed in the same directory; the
feeds themselves are refreshed by the private `pf-scout-bot` hourly
pipeline that commits + pushes to this repo from cron.

See [`docs/DESIGN.md`](docs/DESIGN.md) for how the cron pipeline, the
sub-properties, and the GitHub Pages serving fit together.

## Repo map

```
pft-validator/
|-- README.md                    <-- you are here
|-- index.html                   <-- top-level validator dashboard (WS live data)
|-- _config.yml                  <-- Jekyll passthrough config (no theme, raw pages)
|-- CNAME                        <-- pft.permanentupperclass.com
|-- robots.txt
|-- sitemap.xml
|-- og.svg                       <-- social card image
|-- .gitignore
|-- docs/
|   `-- DESIGN.md                <-- site architecture + hourly pipeline contract
|-- .well-known/
|   `-- xrp-ledger.toml          <-- XRPL validator attestation
|
|-- scanner/                     <-- LLM Convergence Scanner dashboard
|   |-- index.html               # static page; fetches scan-results.json
|   `-- scan-results.json        # written by ~/puc-trading scanner via deploy script
|
|-- herald/                      <-- The Hive Herald (validator newsletter)
|   |-- index.html
|   |-- v2/                      # v2 export pipeline
|   `-- (daily editions + latest.json)
|
|-- subs/                        <-- SUBS service marketplace
|   |-- index.html
|   `-- (registry feeds)
|
|-- lens/                        <-- on-chain intelligence dashboard
|   `-- index.html
|
|-- forensics/                   <-- forensic sybil-supersession reports
|   `-- index.html
|
|-- alpha/                       <-- public alpha submissions for PFT tasks
|   |-- 2026-04-09_verification-pipeline-orchestrator/
|   |-- adoption-metrics/
|   |-- ... (60+ task deliverables)
|   `-- audit-report-2026-04-15.md
|
|-- assets/                      <-- shared images / icons
|-- research/                    <-- public-safe research artifacts
|-- subs-protocol.md             <-- SUBS protocol spec
|-- subs-spec.md                 <-- SUBS implementation spec
|-- multi-agent-registry-spec.md <-- registry spec
`-- task-alpha-spec.md           <-- alpha task submission schema
```

## Sub-properties (live URLs)

| Path | What it is | Refreshed by |
|---|---|---|
| `/` | Validator dashboard with live WebSocket data from the node | Static (no cron) |
| `/scanner/` | LLM Convergence Scanner ranked options table | M5 deploy script in `puc-trading` |
| `/herald/` | The Hive Herald editions + latest.json | Hourly: `export-herald.sh` + daily delivery at 05:00 UTC |
| `/subs/` | SUBS service marketplace registry | Hourly: `export-subs.sh` |
| `/lens/` | On-chain intelligence | Hourly: lens update step |
| `/forensics/` | Forensic case reports | Manual |
| `/alpha/<task>/` | Public alpha task deliverables | Manual (per-submission) |
| `/.well-known/xrp-ledger.toml` | Validator domain attestation | Manual |

## The hourly pipeline

A cron job on the `pf-scout-bot` box runs `/home/ubuntu/pf-scout-bot/deploy/hourly-pipeline.sh`
every hour. It:

1. Crawls the chain index.
2. Exports audit feeds (`export-audit.sh`).
3. Exports the agent graph (`export-graph.sh`).
4. Exports health / auth / subs / herald snapshots.
5. Commits the updated feeds into THIS repo and pushes to `origin/main`.

You should see hourly commits in the log titled like
`Health snapshot 2026-05-14T20:05` and `Lens update 2026-05-14T20:05`.
If you don't, the pipeline is dead -- see
[`docs/DESIGN.md`](docs/DESIGN.md) for failure modes and recovery.

## Bringup

The site is hosted by GitHub Pages directly off `main`. No build step.

1. DNS: `pft.permanentupperclass.com` CNAME to `P-U-C.github.io`.
2. The `CNAME` file in this repo's root pins the custom domain.
3. The hourly pipeline runs from the `pf-scout-bot` box. Its push token
   is provisioned out-of-band (see private operator context).

## Companion repos

- [`puc-trading`](https://github.com/P-U-C/puc-trading) -- private. Writes
  the `/scanner/scan-results.json` content.
- [`trend-corpus`](https://github.com/P-U-C/trend-corpus) -- public template.
  Documents the sources -> claims -> packets pattern that the scanner's
  convergence layer follows. The peptides theme there is the canonical
  example.

## What does NOT belong in this repo

- Bot credentials, deploy tokens, OAuth files.
- Raw private trade history.
- IB Gateway runtime artifacts (`jts.ini`, `launcher.log`, browser-extension
  install dirs) -- already gitignored.
