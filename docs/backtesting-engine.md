# Backtesting Engine v0.14.0

The backtesting engine evaluates settled feature vectors from the Feature Store.

It does not predict future games yet. It answers this question:

> If the system had followed a historical rule, what would the paper performance have been?

Input source:

- `apps/api/data/feature-store/features.jsonl`

Runtime output:

- `apps/api/data/backtesting/backtest-runs.jsonl`
- `apps/api/data/backtesting/latest-run.json`

Endpoints:

- `POST /backtesting/run`
- `GET /backtesting/runs`
- `GET /backtesting/latest`
- `GET /backtesting/summary`

Example:

```json
{
  "source": "paper_pick",
  "outcomeKnownOnly": true,
  "minExpectedValue": 0,
  "minScannerScore": 0,
  "stakingMode": "flat",
  "flatStake": 1,
  "maxRows": 10000
}
```

Important rules:

- Backtesting must only use settled or voided rows.
- Open paper picks must not be treated as outcomes.
- The report is not a betting recommendation.
- A profitable backtest is not proof that the model is ready; it only means the rule is worth investigating.
