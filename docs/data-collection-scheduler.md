# Data Collection Scheduler

The Data Collection Scheduler adds a local in-process timer around the Continuous Collector.
It can run the data pipeline manually or on a fixed interval while the API process is alive.

## Endpoints

- `POST /scheduler/start` — start an in-process recurring collection loop.
- `POST /scheduler/stop` — stop the local timer.
- `POST /scheduler/run-now` — execute one scheduler-triggered collector cycle immediately.
- `GET /scheduler/status` — inspect current scheduler state.
- `GET /scheduler/runs` — list scheduler-triggered runs.
- `GET /scheduler/latest` — read latest scheduler-triggered run.
- `GET /scheduler/summary` — aggregate scheduler run history.

## Why this exists

Draftea Lens needs repeated paper picks, odds snapshots, feature rebuilds, and data quality audits.
Manual runs are useful for debugging, but the model only learns when the dataset grows consistently.

## Safety notes

This scheduler is intentionally local and in-process. It is good for development and a small local collector.
For production, replace it with an external scheduler such as cron, a queue worker, GitHub Actions, or a cloud scheduler.

The scheduler does not place real bets. It only triggers paper collection and dataset preparation.
