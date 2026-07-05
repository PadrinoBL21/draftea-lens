# Model Governance — Champion vs Challenger

This module prevents a new model from replacing the current decision system just because it exists.

## Roles

- **Champion**: the currently trusted production decision layer. The default champion is the deterministic `consensus-ev-v0.1` rules engine.
- **Challenger**: a newer model, such as `ml-baseline-v0.1`, being evaluated against governance thresholds.

## Why this exists

The ML baseline can produce predictions, but it should not automatically control recommendations. Promotion requires evidence:

- trained model status
- enough training rows
- enough validation rows
- enough eligible backtest rows
- acceptable ROI
- acceptable drawdown
- acceptable calibration metrics when configured

## Endpoints

```text
POST /model-governance/evaluate
POST /model-governance/promote
GET  /model-governance/champion
GET  /model-governance/evaluations
GET  /model-governance/summary
```

## Runtime files

Governance writes local runtime files under:

```text
data/model-governance/
```

These files should be ignored by Git.

## Safety rule

Promotion does not authorize real-money staking. It only changes which model is considered the active internal champion. Real stake gates must remain separate.
