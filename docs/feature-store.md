# Feature Store v0.13.0

The feature store converts runtime learning data into stable ML-ready rows.

Sources:

- Paper Betting Ledger: paper picks, paper stake, settlement labels, paper profit/loss, CLV.
- Odds History: market line observations and line movement features.

Runtime output is local-only and must not be committed:

- `apps/api/data/feature-store/features.jsonl`
- `apps/api/data/feature-store/latest-rebuild.json`

Important rule:

Core/math calculates signals. Paper ledger records hypotheses. Settlement records outcomes. Odds history records market movement. Feature Store joins those into training rows.

Endpoints:

- `POST /feature-store/rebuild`
- `GET /feature-store/features`
- `GET /feature-store/dataset`
- `GET /feature-store/summary`

Example rebuild:

```json
{
  "includePaperPicks": true,
  "includeOddsLines": true,
  "maxVectors": 5000
}
```

A feature vector is not a recommendation. It is a learning row for backtesting and later ML models.
