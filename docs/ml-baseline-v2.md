# ML Baseline v2

ML Baseline v2 trains from the formal Training Dataset Export instead of raw feature-store rows.

Pipeline:

1. Result Intake imports official or manually verified results.
2. Settlement writes outcomes to paper picks.
3. Labeling Pipeline turns outcomes into trainable labels.
4. Training Dataset Export writes JSONL/CSV rows.
5. ML Baseline v2 reads the latest dataset export.

Endpoints:

- `POST /ml-baseline-v2/train`
- `GET /ml-baseline-v2/latest`
- `GET /ml-baseline-v2/predictions`
- `GET /ml-baseline-v2/summary`

The model remains challenger-only. It never suggests real stake and keeps `realStakeSuggested` at `0`.

Expected early status is `insufficient_data` until enough win/loss labels exist.
