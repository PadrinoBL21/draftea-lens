# Auto Scanner v0.1

This LEGO adds a first API-first scanner:

- `POST /scanner/auto-scan`
- Fetches real odds from The Odds API.
- Groups markets by event, market, selection, and point.
- Finds best price, worst price, average price, implied probability, price spread, and market hold.
- Returns a ranked market-intelligence watchlist.

Important: this is not a betting model yet. It does not calculate true EV and always returns `stakeSuggested: 0` until model probabilities are connected.

Example:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/scanner/auto-scan" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "bankroll": 1000,
    "sport": "baseball_mlb",
    "regions": "us",
    "markets": "h2h,spreads,totals",
    "oddsFormat": "decimal",
    "maxResults": 20,
    "minBookmakers": 2
  }'
```
