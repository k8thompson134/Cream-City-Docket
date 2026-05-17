"""Find the Nov 2025 budget amendment vetoes."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from poller import client
import time

# All matters modified in the veto window (Nov 15 - Dec 1, 2025)
results = client._get("/Matters", params={
    "$filter": "MatterLastModifiedUtc ge datetime'2025-11-15T00:00:00' and MatterLastModifiedUtc le datetime'2025-12-05T00:00:00'",
    "$orderby": "MatterLastModifiedUtc desc",
    "$top": "200",
})

print(f"Matters modified Nov 15 - Dec 5, 2025: {len(results)}")
print()

# Check each one's history for veto/return actions
print("Scanning histories for veto actions...")
for r in results:
    mid = r.get("MatterId")
    histories = client.get_matter_histories(mid)
    for h in histories:
        name = (h.get("MatterHistoryActionName") or "").upper()
        if any(kw in name for kw in ["RETURN", "VETO", "OVERRIDE"]):
            print(f"  ** FOUND: File {r.get('MatterFile')}  ID={mid}")
            print(f"     Title: {r.get('MatterTitle','')[:80]}")
            print(f"     Action: {name}  Date: {h.get('MatterHistoryActionDate','')[:10]}")
    time.sleep(0.3)

print("Done.")
