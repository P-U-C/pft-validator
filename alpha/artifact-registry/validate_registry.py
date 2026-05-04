#!/usr/bin/env python3
"""
Validate the Post Fiat Artifact Reuse Registry.

Checks:
- JSON parses cleanly
- CSV parses cleanly
- JSON entry_count matches actual entries
- CSV row count matches JSON entry count
- CSV and JSON IDs are identical and in same order
- All required fields present and non-empty
- No duplicate IDs or asset names
- URL scheme is https:// or project-scoped://
- No wallet-pattern strings in privacy-sensitive fields
- No email addresses
- No private hostnames (localhost, 192.168.x.x, 10.x.x.x)
- No bidirectional Unicode control characters
- Schema validation (if jsonschema available)
"""

import csv
import json
import re
import sys
from pathlib import Path

REQUIRED_FIELDS = [
    "id", "asset_name", "lane", "artifact_type", "public_url",
    "status", "maintainer_category", "reuse_instructions",
    "suggested_reproduction_task", "duplicate_risk_notes", "evidence_standard"
]

ALLOWED_URL_SCHEMES = ("https://", "project-scoped://")
WALLET_PATTERN = re.compile(r'\br[A-Za-z0-9]{24,34}\b')
EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PRIVATE_HOST_PATTERN = re.compile(r'(localhost|127\.0\.0\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)')
BIDI_RANGES = set(range(0x202A, 0x202F)) | set(range(0x2066, 0x2070))


def check_bidi(text, filename):
    """Check for bidirectional Unicode control characters."""
    bad = [c for c in text if ord(c) in BIDI_RANGES]
    if bad:
        return f"{filename}: found {len(bad)} bidirectional control characters"
    return None


def check_privacy(text, entry_id):
    """Check for privacy-unsafe patterns."""
    issues = []
    if WALLET_PATTERN.search(text):
        issues.append(f"{entry_id}: contains wallet-like address pattern")
    if EMAIL_PATTERN.search(text):
        issues.append(f"{entry_id}: contains email address")
    if PRIVATE_HOST_PATTERN.search(text):
        issues.append(f"{entry_id}: contains private/localhost hostname")
    return issues


def main():
    errors = []
    warnings = []
    base = Path(__file__).parent

    # 1. Parse JSON
    json_path = base / "registry.json"
    try:
        with json_path.open() as f:
            data = json.load(f)
        print("OK: registry.json parses")
    except Exception as e:
        errors.append(f"FAIL: registry.json parse error: {e}")
        print(errors[-1])
        sys.exit(1)

    # 2. Parse CSV
    csv_path = base / "registry.csv"
    try:
        with csv_path.open(newline="") as f:
            rows = list(csv.DictReader(f))
        print("OK: registry.csv parses")
    except Exception as e:
        errors.append(f"FAIL: registry.csv parse error: {e}")
        print(errors[-1])
        sys.exit(1)

    # 3. Entry count consistency
    json_count = data.get("entry_count", 0)
    actual_json = len(data.get("entries", []))
    csv_count = len(rows)

    if json_count == actual_json == csv_count:
        print(f"OK: {csv_count} CSV rows match {actual_json} JSON entries (declared: {json_count})")
    else:
        errors.append(f"FAIL: count mismatch — declared={json_count}, json_entries={actual_json}, csv_rows={csv_count}")
        print(errors[-1])

    # 4. ID order match
    json_ids = [e["id"] for e in data.get("entries", [])]
    csv_ids = [r.get("id", "") for r in rows]
    if json_ids == csv_ids:
        print("OK: CSV/JSON ID order matches")
    else:
        errors.append("FAIL: CSV/JSON ID order mismatch")
        print(errors[-1])

    # 5. Required fields present and non-empty
    field_issues = []
    for i, entry in enumerate(data.get("entries", []), 1):
        for field in REQUIRED_FIELDS:
            if field not in entry:
                field_issues.append(f"JSON entry {i} missing field: {field}")
            elif not str(entry[field]).strip():
                field_issues.append(f"JSON entry {i} empty field: {field}")

    for i, row in enumerate(rows, 1):
        for field in REQUIRED_FIELDS:
            if field not in row:
                field_issues.append(f"CSV row {i} missing field: {field}")
            elif not str(row.get(field, "")).strip():
                field_issues.append(f"CSV row {i} empty field: {field}")

    if field_issues:
        for issue in field_issues:
            errors.append(f"FAIL: {issue}")
            print(errors[-1])
    else:
        print("OK: all required fields present and non-empty")

    # 6. No duplicate IDs
    if len(json_ids) == len(set(json_ids)):
        print("OK: no duplicate IDs")
    else:
        errors.append("FAIL: duplicate IDs found")
        print(errors[-1])

    # 7. No duplicate asset names
    names = [e.get("asset_name", "") for e in data.get("entries", [])]
    if len(names) == len(set(names)):
        print("OK: no duplicate asset names")
    else:
        errors.append("FAIL: duplicate asset names found")
        print(errors[-1])

    # 8. URL scheme check
    url_issues = []
    for entry in data.get("entries", []):
        url = entry.get("public_url", "")
        if not any(url.startswith(s) for s in ALLOWED_URL_SCHEMES):
            url_issues.append(f"{entry['id']}: invalid URL scheme: {url[:30]}")
    if url_issues:
        for issue in url_issues:
            errors.append(f"FAIL: {issue}")
            print(errors[-1])
    else:
        print("OK: all URLs use allowed schemes (https:// or project-scoped://)")

    # 9. Privacy checks
    privacy_issues = []
    for entry in data.get("entries", []):
        text = json.dumps(entry)
        privacy_issues.extend(check_privacy(text, entry["id"]))
    if privacy_issues:
        for issue in privacy_issues:
            warnings.append(f"WARN: {issue}")
            print(warnings[-1])
    else:
        print("OK: privacy pattern checks passed (no wallets, emails, private hosts)")

    # 10. Bidi character check
    bidi_issues = []
    for name in ["registry.json", "registry.csv", "README.md"]:
        filepath = base / name
        if filepath.exists():
            content = filepath.read_text()
            issue = check_bidi(content, name)
            if issue:
                bidi_issues.append(issue)
    if bidi_issues:
        for issue in bidi_issues:
            errors.append(f"FAIL: {issue}")
            print(errors[-1])
    else:
        print("OK: no bidirectional Unicode control characters")

    # 11. Schema validation (optional)
    schema_path = base / "registry.schema.json"
    if schema_path.exists():
        try:
            from jsonschema import validate, ValidationError
            with schema_path.open() as f:
                schema = json.load(f)
            validate(instance=data, schema=schema)
            print("OK: registry.json validates against registry.schema.json")
        except ImportError:
            print("SKIP: jsonschema not installed (pip install jsonschema)")
        except ValidationError as e:
            errors.append(f"FAIL: schema validation: {e.message}")
            print(errors[-1])

    # Summary
    print(f"\n{'='*50}")
    if errors:
        print(f"FAILED: {len(errors)} error(s), {len(warnings)} warning(s)")
        sys.exit(1)
    else:
        print(f"PASSED: all checks green, {len(warnings)} warning(s)")
        sys.exit(0)


if __name__ == "__main__":
    main()
