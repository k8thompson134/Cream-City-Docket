"""
Q: What MatterTypes does Milwaukee actually use, and how common is each?
Pulls 200 recent Matters and tabulates MatterType values.
"""
import httpx
from collections import Counter

BASE = "https://webapi.legistar.com/v1/milwaukee"

r = httpx.get(
    f"{BASE}/Matters",
    params={"$top": 200, "$orderby": "MatterId desc"},
    timeout=30,
)
r.raise_for_status()
matters = r.json()

type_counts = Counter(m.get("MatterTypeName", "MISSING") for m in matters)
status_counts = Counter(m.get("MatterStatusName", "MISSING") for m in matters)

print(f"Sampled {len(matters)} matters\n")

print("=== MatterType counts ===")
for name, count in type_counts.most_common():
    print(f"  {count:4d}  {name}")

print("\n=== MatterStatus counts ===")
for name, count in status_counts.most_common():
    print(f"  {count:4d}  {name}")

# Show which types have non-null MatterText pointers
print("\n=== MatterBodyName (committee) sample ===")
body_counts = Counter(m.get("MatterBodyName", "MISSING") for m in matters)
for name, count in body_counts.most_common(10):
    print(f"  {count:4d}  {name}")
