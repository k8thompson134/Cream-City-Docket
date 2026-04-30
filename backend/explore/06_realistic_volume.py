"""
Q: What does a realistic month of Milwaukee legislative data look like?
Pulls all Matters from the past 30 days and breaks down by type.
Estimates weekly LLM enrichment cost based on real volume.
"""
import httpx
from datetime import datetime, timedelta, timezone
from collections import Counter

BASE = "https://webapi.legistar.com/v1/milwaukee"

since = datetime.now(timezone.utc) - timedelta(days=30)
since_str = since.strftime("%Y-%m-%dT%H:%M:%S")

print(f"Pulling all Matters introduced or modified since {since_str[:10]}...\n")

all_matters = []
skip = 0
top = 200

while True:
    r = httpx.get(
        f"{BASE}/Matters",
        params={
            "$filter": f"MatterLastModifiedUtc ge datetime'{since_str}'",
            "$top": top,
            "$skip": skip,
            "$orderby": "MatterLastModifiedUtc desc",
        },
        timeout=30,
    )
    r.raise_for_status()
    batch = r.json()
    if not batch:
        break
    all_matters.extend(batch)
    if len(batch) < top:
        break
    skip += top

print(f"Total Matters in last 30 days: {len(all_matters)}")
print(f"Estimated per week: ~{len(all_matters) // 4}")
print(f"Estimated per day: ~{len(all_matters) // 30}\n")

type_counts = Counter(m.get("MatterTypeName", "MISSING") for m in all_matters)
print("=== Breakdown by MatterType ===")
for name, count in type_counts.most_common():
    print(f"  {count:4d}  {name}")

# Alert-worthy types only (from requirements doc)
alert_types = {"Ordinance", "Charter Ordinance", "Resolution"}
alert_worthy = [m for m in all_matters if m.get("MatterTypeName") in alert_types]
print(f"\nAlert-worthy (Ordinance + Charter Ord + Resolution): {len(alert_worthy)} in 30 days")
print(f"  = ~{len(alert_worthy) // 4}/week to enrich with LLM")

# Haiku cost estimate
# Input: ~2000 tokens per bill text, Output: ~200 tokens summary
# Haiku pricing: $0.80/M input, $4/M output (as of 2025)
weekly = len(alert_worthy) // 4
input_cost = (weekly * 2000 / 1_000_000) * 0.80
output_cost = (weekly * 200 / 1_000_000) * 4.00
print(f"\n=== Claude Haiku cost estimate ===")
print(f"  ~{weekly} enrichments/week")
print(f"  Input cost:  ${input_cost:.4f}/week")
print(f"  Output cost: ${output_cost:.4f}/week")
print(f"  Total:       ${(input_cost + output_cost) * 4:.4f}/month")
print(f"  (assumes 2000 input tokens + 200 output tokens per bill)")
