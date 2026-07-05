# Dashboard Web UI

Angular dashboard for the Draftea Lens command center.

## Purpose

This UI displays the API dashboard modules in one place:

- Dataset readiness
- Paper pick count
- Odds history observations
- Feature vector count
- Latest collector and scheduler runs
- Latest backtest
- Champion vs Challenger model status
- Risks, blockers, warnings, and operational recommendations

## Install

After copying this package into the repository root, run:

```powershell
node tools/install-dashboard-web-ui.mjs
npm pkg set scripts.qa:dashboard-web="node test/qa-dashboard-web-ui.mjs" --workspace apps/web
npm pkg set scripts.qa="npm run test:core && npm run qa:fixtures && npm --workspace apps/api run qa:backtesting && npm --workspace apps/api run qa:ml-baseline && npm --workspace apps/api run qa:model-governance && npm --workspace apps/api run qa:data-quality && npm --workspace apps/api run qa:collector && npm --workspace apps/api run qa:settlement-assistant && npm --workspace apps/api run qa:scheduler && npm --workspace apps/api run qa:dashboard && npm --workspace apps/web run qa:dashboard-web"
```

## Runtime

Start the API first:

```powershell
$env:THE_ODDS_API_KEY="TU_API_KEY_AQUI"
npm run dev:api
```

Then start the Angular web app:

```powershell
npm --workspace apps/web run start
```

The dashboard calls:

- `GET /dashboard/overview`
- `GET /dashboard/backtesting`
- `GET /dashboard/collection`
- `GET /dashboard/models`
- `GET /dashboard/risks`

## Safety

This UI is read-only. It does not place bets, promote models, or mutate runtime data.
