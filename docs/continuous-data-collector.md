# Continuous Data Collector

LEGO 18 adds a single-cycle collector that runs the data pipeline in order:

1. Save paper picks from Smart Scanner.
2. Save an odds history snapshot.
3. Rebuild the feature store.
4. Run a data quality audit.

The collector does not place real bets and does not promote ML models. It only grows the local learning dataset.

## Endpoints

- `POST /collector/run-once`
- `GET /collector/runs`
- `GET /collector/latest`
- `GET /collector/summary`

## Example

```json
{
  "bankroll": 1250,
  "runLabel": "manual-cycle",
  "enablePaperPicks": true,
  "maxPaperPicks": 10,
  "enableOddsSnapshot": true,
  "maxLines": 200,
  "rebuildFeatureStore": true,
  "maxFeatureVectors": 5000,
  "auditDataQuality": true,
  "persistDataQualityAudit": true
}
```

Use an external scheduler, cron, Windows Task Scheduler, or a future automation layer to call this endpoint repeatedly. Keep runtime data out of Git.
