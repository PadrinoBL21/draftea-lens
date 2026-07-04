# LEGO 4 — External Odds API Adapter

This LEGO adds an API-first source adapter for The Odds API.

## Environment

Add the key to PowerShell before running the API:

```powershell
$env:THE_ODDS_API_KEY="YOUR_KEY_HERE"
```

Or add it to a local `.env` when dotenv support is added.

## Endpoints

```text
GET /sources/the-odds-api/sports
GET /sources/the-odds-api/odds?sport=baseball_mlb&regions=us&markets=h2h,spreads,totals&oddsFormat=decimal
GET /sources/the-odds-api/event-odds?sport=soccer_mexico_ligamx&eventId=EVENT_ID&regions=us,eu&markets=h2h,btts,draw_no_bet,alternate_spreads,alternate_totals&oddsFormat=decimal
```

## Notes

- Draftea is not assumed as the source here.
- This adapter provides external market coverage and normalizes it into Draftea Lens market objects.
- If a Draftea-authorized feed is discovered later, it should be implemented as a separate adapter.
