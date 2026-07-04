# Draftea Lens Starter

Primer LEGO del proyecto: motor matemático + API de Moneyline Analyzer.

## Requisitos

- Node.js 20+
- npm 10+
- Docker + Docker Compose

## Arranque rápido

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev:api
```

API local:

```txt
http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/health
```

Moneyline Analyzer:

```bash
curl -X POST http://localhost:3000/moneyline/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Canada vs Morocco",
    "bankroll": 1000,
    "outcomes": [
      { "label": "Canada", "oddsDecimal": 2.40, "modelProbability": 0.412 },
      { "label": "Draw", "oddsDecimal": 3.25, "modelProbability": 0.268 },
      { "label": "Morocco", "oddsDecimal": 2.90, "modelProbability": 0.320 }
    ]
  }'
```
