# ML Baseline v0.15.0

The ML Baseline is the first lightweight model layer for Draftea Lens.

It does **not** replace the scanner. It is a challenger-only baseline that learns from settled Feature Store rows.

Input source:

- `apps/api/data/feature-store/features.jsonl`

Runtime output:

- `apps/api/data/ml-baseline/models.jsonl`
- `apps/api/data/ml-baseline/latest-model.json`
- `apps/api/data/ml-baseline/predictions.jsonl`

Endpoints:

- `POST /ml-baseline/train`
- `GET /ml-baseline/latest`
- `GET /ml-baseline/predictions`
- `GET /ml-baseline/summary`

Example train request:

```json
{
  "source": "paper_pick",
  "minTrainingRows": 20,
  "maxRows": 10000,
  "epochs": 500,
  "learningRate": 0.05,
  "validationSplit": 0.2
}
```

Useful smoke-test request while there are few real settlements:

```json
{
  "source": "paper_pick",
  "minTrainingRows": 2,
  "maxRows": 10000,
  "epochs": 200,
  "learningRate": 0.05,
  "validationSplit": 0.2
}
```

Important rules:

- This is intentionally simple logistic regression implemented without external ML dependencies.
- It trains only on vectors with `labelWin` equal to `0` or `1`.
- `void` and `push` outcomes do not become win/loss labels.
- If there are not enough labeled rows, the model status becomes `insufficient_data`.
- ML predictions are paper-only.
- `realStakeSuggested` remains `0` by design.
- The scanner remains the champion until backtesting proves a challenger is better.

Feature columns used:

- `logBestOdds`
- `consensusProbability`
- `edgeVsConsensus`
- `expectedValuePerUnit`
- `scannerScore`
- `priceSpreadPct`
- `marketHoldPct`
- `lineObservationCount`
- `oddsChangePct`
- `impliedProbabilityChange`
- `consensusProbabilityChange`
- `expectedValueChange`
- `sourcePaperPick`
- `trendShortening`
- `trendDrifting`
- `recommendationValueCandidate`

Next LEGO:

- v0.16.0 — Champion/Challenger Model Registry
