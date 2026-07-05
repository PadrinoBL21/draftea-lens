# QA Automation Gate

This gate protects Draftea Lens from learning from broken data.

## Rules

- No LEGO closes without tests.
- No paper pick enters the learning loop without required fields.
- No non-value candidate may suggest a real stake.
- API quota should not be consumed by normal QA runs; use fixtures.
- Live API tests must be opt-in and manual.

## Commands

```powershell
npm run test:core
npm --workspace apps/api run qa:fixtures
npm run qa
```

## Current coverage

- Consensus EV unit tests.
- Paper Betting Ledger fixture validation.
- Safety rule: paper-only picks can have `paperStake`, but real stake stays gated.

## Next coverage

- Settlement fixture tests.
- Odds history snapshot tests.
- Regression tests for scanner ranking.
- Backtesting fixture tests.
