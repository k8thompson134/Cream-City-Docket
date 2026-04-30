"""
Q: Does MatterText exist reliably for all MatterTypes?
Samples 50 recent Matters and checks which have accessible text versions.
"""
import httpx, json
from collections import defaultdict

BASE = "https://webapi.legistar.com/v1/milwaukee"

# Grab 50 recent matters
r = httpx.get(
    f"{BASE}/Matters",
    params={"$top": 50, "$orderby": "MatterId desc"},
    timeout=30,
)
r.raise_for_status()
matters = r.json()

results = defaultdict(lambda: {"has_text": 0, "no_text": 0, "examples": []})

for m in matters:
    mid = m["MatterId"]
    mtype = m.get("MatterTypeName", "UNKNOWN")

    # Step 1: get version IDs from /Versions
    vr = httpx.get(f"{BASE}/Matters/{mid}/Versions", timeout=10)
    versions = vr.json() if vr.status_code == 200 else []

    if versions:
        # Step 2: fetch the latest version text using the Key as textId
        latest = versions[-1]
        text_id = latest["Key"]
        tr = httpx.get(f"{BASE}/Matters/{mid}/Texts/{text_id}", timeout=10)
        text_data = tr.json() if tr.status_code == 200 else {}
        has_content = bool(text_data.get("MatterTextPlain", "").strip())

        if has_content:
            results[mtype]["has_text"] += 1
            if len(results[mtype]["examples"]) < 2:
                results[mtype]["examples"].append({
                    "id": mid,
                    "title": m.get("MatterTitle", "")[:80],
                    "versions": len(versions),
                    "latest_version": text_data.get("MatterTextVersion", "?"),
                    "text_preview": text_data["MatterTextPlain"][:100],
                })
        else:
            results[mtype]["no_text"] += 1
    else:
        results[mtype]["no_text"] += 1

print("=== MatterText availability by MatterType ===\n")
for mtype, data in sorted(results.items()):
    total = data["has_text"] + data["no_text"]
    pct = 100 * data["has_text"] // total
    print(f"{mtype}: {data['has_text']}/{total} have text ({pct}%)")
    for ex in data["examples"]:
        print(f"    Matter {ex['id']} — {ex['versions']} version(s), latest: {ex['latest_version']}")
        print(f"    \"{ex['title']}\"")
