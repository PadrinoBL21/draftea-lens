# LEGO 17 — Data Quality + Minimum Training Dataset

Data Quality is the gate before heavier ML and neural models.

It audits local runtime data from:

- `data/paper-ledger/paper-picks.jsonl`
- `data/odds-history/odds-lines.jsonl`
- `data/feature-store/features.jsonl`
- `data/backtesting/latest-run.json`
- `data/ml-baseline/latest-model.json`

## Endpoints

- `POST /data-quality/audit`
- `GET /data-quality/report`
- `GET /data-quality/readiness`
- `GET /data-quality/summary`

## Readiness states

- `not_ready`
- `collecting_data`
- `ready_for_baseline_training`
- `ready_for_backtesting`
- `ready_for_neural_training`

## Rules

Do not promote or trust ML/neural models while data quality blockers exist.

The first expected state is usually `collecting_data`, because the project has architecture but not enough settled win/loss labels yet.
