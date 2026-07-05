# LEGO 11 — Settlement Tracker

This module closes open paper picks and turns hypotheses into learning records.

## Endpoints

### GET /paper/open?limit=25

Returns open paper picks waiting for a result.

### POST /paper/settle

Settles a paper pick manually.

```json
{
  "paperPickId": "paper_1_20260705002602_l3uygx",
  "result": "win",
  "closingOdds": 9.2,
  "notes": "Manual settlement after final result."
}
```

Allowed results:

- `win`
- `loss`
- `push`
- `void`
- `half_win`
- `half_loss`

The system calculates `paperProfitLoss` using decimal odds and the saved `paperStake`.

If `closingOdds` is provided, the system calculates approximate closing line value:

```text
closingLineValue = pickOddsDecimal / closingOddsDecimal - 1
```

Positive CLV means the pick beat the closing price.

### GET /paper/settled?limit=25

Returns the latest settled or void paper picks.

### GET /paper/settlement-summary

Returns simple paper performance metrics:

- open picks
- settled picks
- wins/losses/pushes
- total paper stake
- total paper profit/loss
- paper ROI
- average CLV

## Important

Settlement is still paper-only. It does not place bets and does not decide real stakes.

This is the bridge between paper betting and future learning/backtesting.
