# Result Settlement Assistant

LEGO 19 adds a guided manual settlement workflow for paper picks.

The assistant does not guess sports results. It lists open picks that are due for settlement, shows the allowed settlement outcomes, and applies user-provided outcomes in batch.

## Endpoints

- `POST /settlement-assistant/preview`
- `GET /settlement-assistant/due`
- `POST /settlement-assistant/apply`
- `GET /settlement-assistant/latest`
- `GET /settlement-assistant/runs`
- `GET /settlement-assistant/summary`

## Workflow

1. Use `/settlement-assistant/due` or `/settlement-assistant/preview` to find open paper picks that should be settled.
2. Verify the official final result manually.
3. Send results to `/settlement-assistant/apply`.
4. The assistant updates the paper ledger, rebuilds the feature store, and runs a data quality audit.

## Safety rule

Never settle a pick by guessing. If the result is unknown, leave it open. If the market was cancelled or invalid, use `void`.
