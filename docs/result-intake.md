# Result Intake / Official Result Source

Version: `result-intake-v0.1`

This module stores official or manually verified match results and matches them against open paper picks. It is designed to turn settled sports outcomes into clean `win/loss/push/void` labels for the Feature Store.

## Endpoints

- `POST /result-intake/import-manual`
- `POST /result-intake/match-open-picks`
- `POST /result-intake/apply-matches`
- `GET /result-intake/results`
- `GET /result-intake/latest`
- `GET /result-intake/summary`

## Safety rules

- It does not guess official results.
- Manual imports should be based on official final scores.
- Automatic settlement is only high-confidence for exact `eventId` matches.
- Unsupported markets are sent to manual review.
- After applying settlements, the module can rebuild Feature Store and audit Data Quality.

## Minimum use flow

1. Import verified results with `POST /result-intake/import-manual`.
2. Match open picks with `POST /result-intake/match-open-picks`.
3. Apply only high-confidence matches with `POST /result-intake/apply-matches`.
4. Check `/data-quality/readiness` and `/dashboard/risks`.
