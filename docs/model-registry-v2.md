# Model Registry v2

Model Registry v2 is the formal Champion vs Challenger registry for Draftea Lens.

The current production-like champion remains `consensus-ev-v0.1`, a rules-based model. ML challengers can be registered and evaluated, but they must remain blocked until the training dataset, labels, and backtesting evidence are strong enough.

## Endpoints

- `GET /model-registry/models`
- `GET /model-registry/latest`
- `GET /model-registry/summary`
- `POST /model-registry/register`
- `POST /model-registry/evaluate`
- `POST /model-registry/promote`

## Promotion gates

A challenger cannot be promoted when it has insufficient data. The default gates are:

- at least 100 training rows
- at least 20 validation rows
- at least 100 backtest rows
- at least 25 positive labels
- at least 25 negative labels
- non-negative ROI when ROI is supplied
- non-negative CLV when CLV is supplied
- max drawdown below the configured threshold when supplied

`force=true` exists only for controlled manual intervention. It should not be used for normal automated promotion.

## Safety rule

The registry does not enable real staking. `REAL_STAKE_ENABLED=false` remains the default. Promotion only changes which model is considered champion for internal governance.
