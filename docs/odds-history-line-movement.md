# Odds History + Line Movement

Version: v0.12.0

This layer records odds observations from the smart scanner over time. The goal is not to place bets automatically. The goal is to create clean historical memory for line movement, closing line value, future backtesting, and later ML features.

## Runtime storage

The API writes runtime data locally under:

```text
data/odds-history/
  odds-lines.jsonl
  snapshots/
    odds_snapshot_*.json
```

Do not commit runtime history files. They are local learning data and should later move to a real database or object storage.

## Endpoints

### POST /odds-history/snapshot

Runs the smart scanner and saves line observations.

```json
{
  "bankroll": 1250,
  "maxLines": 100
}
```

### GET /odds-history/lines

Returns saved line observations.

Optional query params:

```text
limit=50
eventId=<event id>
lineId=<line id>
```

### GET /odds-history/movements

Groups observations by line and returns movement metrics:

```text
firstOddsDecimal
latestOddsDecimal
oddsChange
oddsChangePct
impliedProbabilityChange
consensusProbabilityChange
expectedValueChange
trend
```

Trend meaning:

```text
shortening = odds moved down, market price became more expensive
drifting = odds moved up, market price became cheaper
flat = no meaningful movement
```

### GET /odds-history/summary

Returns counts for snapshots, line observations, unique lines, tracked sports and tracked events.

## QA rule

The QA fixture now validates that odds history observations include stable line ids, versioned model source, odds, consensus probability, EV, bookmaker count, spread, scanner recommendation and a features snapshot.

This layer is the bridge between paper betting and real model training. Later modules will use this history to calculate closing line value, identify stale prices, train features, and run backtests.
