#!/usr/bin/env python3
"""
Seed trust_registry DynamoDB table with demo agent entries.

IDs are produced by pick_agent_ids(2, min_distance=11):
  0    and  2047  sit 11 bits apart in Hamming distance.
  11 bits of separation absorbs up to 5 bit errors per the formula 2e+1=11 (e=5).
  At the measured error rate of 3–5 bits per re-recording, this makes the two
  agents distinguishable. A third agent would drop separation to ~9 bits (4
  correctable errors) — don't add one without re-running the hardware test.

FIX 2: agent_id stored as Number (N), not String (S).
  The handler does integer XOR for Hamming distance — a string key causes
  int() conversion bugs and breaks nearest_agent().

Keep these entries in sync with _LOCAL_REGISTRY in handler.py:
  {0: "SecureBank AI Assistant", 2047: "Example Telecom Support"}

Usage (after `make infra`):
  python infra/seed_registry.py
  python infra/seed_registry.py --table trust_registry --region ap-south-1
"""

import argparse
import sys

import boto3

REGION = "ap-south-1"
TABLE = "trust_registry"

# FIX 2: IDs must match pick_agent_ids(2, min_distance=11) output.
# Do NOT change to 1337/42 — they are only 5 bits apart and cause wrong-entity matches.
ENTRIES = [
    {"agent_id": 0,    "entity_name": "SecureBank AI Assistant"},
    {"agent_id": 2047, "entity_name": "Example Telecom Support"},
]


def seed(table: str, region: str) -> None:
    ddb = boto3.client("dynamodb", region_name=region)
    print(f"Seeding {len(ENTRIES)} entries into {table} ({region})...\n")
    for entry in ENTRIES:
        ddb.put_item(
            TableName=table,
            Item={
                # Type N (Number) — the handler does integer XOR on these values.
                "agent_id":    {"N": str(entry["agent_id"])},
                "entity_name": {"S": entry["entity_name"]},
            },
        )
        print(f"  agent_id={entry['agent_id']:<6}  →  {entry['entity_name']!r}")

    print(f"\nDone. DynamoDB table '{table}' is ready for the demo.")
    print("\nVerify handler.py LOCAL registry matches:")
    print("_LOCAL_REGISTRY = {")
    for e in ENTRIES:
        print(f"    {e['agent_id']}: {e['entity_name']!r},")
    print("}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--table", default=TABLE, help=f"DynamoDB table name (default: {TABLE})")
    parser.add_argument("--region", default=REGION, help=f"AWS region (default: {REGION})")
    args = parser.parse_args()
    seed(args.table, args.region)
