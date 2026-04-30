"""
Q: Is the Legistar API reachable? What do real Milwaukee Matter records look like?
Prints the 5 most recently updated Matters with full field listing.
"""
import httpx, json

BASE = "https://webapi.legistar.com/v1/milwaukee"

r = httpx.get(
    f"{BASE}/Matters",
    params={"$top": 5, "$orderby": "MatterId desc"},
    timeout=15,
)
r.raise_for_status()
matters = r.json()

print(f"Status: {r.status_code}")
print(f"Rate-limit headers: { {k: v for k, v in r.headers.items() if 'rate' in k.lower()} }")
print(f"\nReturned {len(matters)} matters\n")
print(json.dumps(matters, indent=2))
