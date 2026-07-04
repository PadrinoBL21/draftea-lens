# LEGO 7 — Dynamic Catalog Scanner

This block changes the product direction from developer-mode filters to user-mode scanning.

## New endpoint

POST /scanner/smart-scan

Input:

```json
{
  "bankroll": 1000
}
```

The backend discovers active sports, chooses a safe scan plan, requests only base markets that are supported by the main odds endpoint, and returns market-intelligence candidates.

## Why this exists

The user should not type sport keys, market keys, regions, or bookmakers. Those belong in API/catalog logic.

## Current limitation

This version scans safe base markets: h2h, spreads, totals. Deep props and special soccer markets should be added through a provider-specific market catalog layer.
