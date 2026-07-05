# LEGO 21 — Backtest Dashboard

The Backtest Dashboard is an API-level dashboard that summarizes the current state of the learning pipeline.

It does not place bets and it does not promote models. It reads runtime data produced by previous modules and makes the current state visible:

- data quality readiness
- paper-pick and label counts
- odds-history and line-movement counts
- latest backtest health
- ML baseline training status
- champion/challenger safety status
- collector and scheduler activity

## Endpoints

- `GET /dashboard/overview`
- `GET /dashboard/backtesting?limit=10`
- `GET /dashboard/collection?limit=10`
- `GET /dashboard/models?limit=10`
- `GET /dashboard/risks`

## Design rule

This module is read-only. It is a visibility layer over collector, scheduler, feature store, backtesting, ML baseline, governance, and data quality.

If Data Quality says `collecting_data`, the dashboard must show that truth instead of pretending the model is ready.
