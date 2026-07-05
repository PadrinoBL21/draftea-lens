# Labeling Pipeline

The Labeling Pipeline converts settled paper pick feature vectors into explicit ML labels.

It does not settle picks and it does not infer official results. It only reads the Feature Store after settlement/result intake has already created known outcomes.

## Endpoints

- `POST /labeling/rebuild`
- `GET /labeling/labels`
- `GET /labeling/dataset`
- `GET /labeling/summary`

## Label rules

- `win` -> positive label, trainable
- `half_win` -> positive label, trainable, weight `0.5`
- `loss` -> negative label, trainable
- `half_loss` -> negative label, trainable, weight `0.5`
- `push` -> neutral, not trainable
- `void` -> excluded, not trainable

## Safety rule

No model should train from raw settlements directly. Training jobs should consume labeled rows from this module or from a downstream dataset export built from this module.
