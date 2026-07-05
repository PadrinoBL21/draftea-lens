# Training Dataset Export

Exports labeled rows from the Labeling Pipeline into clean model-training datasets.

## Endpoints

- `POST /training-dataset/export` exports JSONL, CSV, or both.
- `GET /training-dataset/exports` lists export runs.
- `GET /training-dataset/latest` returns the latest export run.
- `GET /training-dataset/dataset` returns rows from the latest JSONL export.
- `GET /training-dataset/summary` returns export readiness counts.

## Notes

- Default export is `eligibleOnly: true`, so `void` and `push` labels are excluded.
- JSONL is the canonical machine-training format.
- CSV is for inspection in Excel or manual review.
- Empty exports are valid while the project is still collecting win/loss labels.
