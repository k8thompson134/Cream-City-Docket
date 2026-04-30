"""
Q: Does incremental polling via MatterLastModified work reliably?
   Are there rate-limit headers?
Tests the $filter approach that the poller will use in production.
"""
import httpx
from datetime import datetime, timedelta, timezone

BASE = "https://webapi.legistar.com/v1/milwaukee"

# Simulate "last poll was 1 hour ago"
since = datetime.now(timezone.utc) - timedelta(hours=1)
since_str = since.strftime("%Y-%m-%dT%H:%M:%S")

print(f"Polling for Matters modified since: {since_str}\n")

r = httpx.get(
    f"{BASE}/Matters",
    params={
        "$filter": f"MatterLastModifiedUtc ge datetime'{since_str}'",
        "$orderby": "MatterLastModifiedUtc desc",
        "$top": 100,
    },
    timeout=15,
)

print(f"Status: {r.status_code}")
print(f"Response time: {r.elapsed.total_seconds():.2f}s")

rate_headers = {k: v for k, v in r.headers.items() if any(x in k.lower() for x in ["rate", "limit", "retry", "x-"])}
if rate_headers:
    print(f"Relevant headers: {rate_headers}")
else:
    print("No rate-limit headers detected")

matters = r.json()
print(f"\nMatters updated in last hour: {len(matters)}")
for m in matters:
    print(f"  {m.get('MatterLastModified','?')[:19]}  [{m.get('MatterTypeName','?')}]  {m.get('MatterTitle','?')[:60]}")

# Also test a 24-hour window
since24 = datetime.now(timezone.utc) - timedelta(hours=24)
since24_str = since24.strftime("%Y-%m-%dT%H:%M:%S")

r2 = httpx.get(
    f"{BASE}/Matters",
    params={
        "$filter": f"MatterLastModifiedUtc ge datetime'{since24_str}'",
        "$top": 200,
    },
    timeout=15,
)
matters24 = r2.json()
print(f"\nMatters updated in last 24 hours: {len(matters24)}")

# Test a 7-day window
since7 = datetime.now(timezone.utc) - timedelta(days=7)
since7_str = since7.strftime("%Y-%m-%dT%H:%M:%S")

r3 = httpx.get(
    f"{BASE}/Matters",
    params={
        "$filter": f"MatterLastModifiedUtc ge datetime'{since7_str}'",
        "$top": 500,
    },
    timeout=15,
)
matters7 = r3.json()
print(f"Matters updated in last 7 days: {len(matters7)}")
