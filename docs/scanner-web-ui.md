# Scanner Web UI

LEGO 6 agrega una interfaz web para `POST /scanner/auto-scan`.

## Objetivo

Permitir que el usuario meta bankroll, deporte, mercados y filtros básicos desde la web. La pantalla consulta mercados reales por API y muestra una watchlist ordenada por inteligencia de mercado.

## Importante

Esta versión no sugiere stake. El scanner todavía opera en modo `market_intelligence_no_model_ev`. El stake se queda en cero hasta conectar probabilidad de modelo y EV.

## Prueba rápida

1. Levantar API con `THE_ODDS_API_KEY` configurada.
2. Levantar web.
3. Abrir `http://localhost:4200`.
4. Presionar `MLB base`.
5. Presionar `Escanear oportunidades`.
