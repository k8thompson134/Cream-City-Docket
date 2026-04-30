"""
Q: How does MatterStatus change over time, and are mayoral actions in MatterHistory?
Finds a few passed Ordinances/Resolutions and dumps their full history.
Also looks for signed/vetoed bills specifically.
"""
import httpx, json

BASE = "https://webapi.legistar.com/v1/milwaukee"

# Find some passed ordinances
r = httpx.get(
    f"{BASE}/Matters",
    params={
        "$top": 200,
        "$orderby": "MatterId desc",
        "$filter": "MatterTypeName eq 'Ordinance'",
    },
    timeout=30,
)
r.raise_for_status()
matters = r.json()

# Collect unique statuses seen
statuses = set(m.get("MatterStatusName") for m in matters)
print("=== Ordinance statuses in sample ===")
for s in sorted(statuses):
    print(f"  {s}")

# Pull history for 3 matters that look complete (passed, signed, etc.)
interesting = [
    m for m in matters
    if any(kw in (m.get("MatterStatusName") or "") for kw in ["Passed", "Signed", "Vetoed", "Adopted", "Failed"])
][:3]

if not interesting:
    interesting = matters[:3]

for m in interesting:
    mid = m["MatterId"]
    print(f"\n{'='*60}")
    print(f"Matter {mid}: {m.get('MatterTitle', '')[:80]}")
    print(f"Type: {m.get('MatterTypeName')}  Status: {m.get('MatterStatusName')}")

    hr = httpx.get(f"{BASE}/Matters/{mid}/Histories", timeout=10)
    histories = hr.json() if hr.status_code == 200 else []
    print(f"History events ({len(histories)}):")
    for h in histories:
        print(f"  {h.get('MatterHistoryActionDate','?')[:10]}  "
              f"[{h.get('MatterHistoryActionName','?')}]  "
              f"{h.get('MatterHistoryBodyName','?')}  "
              f"result={h.get('MatterHistoryPassedFlagName','?')}")
