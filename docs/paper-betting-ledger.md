# LEGO 10 — Paper Betting Ledger

This module adds a paper-trading memory layer for Draftea Lens.

## Endpoints

### POST /paper/scan-and-save

Runs the smart scanner, creates paper-only picks, and saves a scan record.

```json
{
  "bankroll": 1250
}
```

The saved records live locally under:

- `data/paper-ledger/scans/*.json`
- `data/paper-ledger/paper-picks.jsonl`

These files are intentionally ignored by Git because they are local learning data.

### GET /paper/scans?limit=10

Reads the latest saved scan records.

### GET /paper/picks?limit=25

Reads the latest paper picks.

## Important

Paper picks are not real betting recommendations. They are hypotheses saved for learning and backtesting.

The system separates:

- `paperStake`: fictitious learning stake.
- `realStakeSuggested`: gated real stake, currently zero unless the scanner marks a true `value_candidate`.
