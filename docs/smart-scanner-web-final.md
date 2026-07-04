# Smart Scanner Web Final

This UI keeps the user flow intentionally simple:

1. User enters bankroll.
2. Web calls `POST /scanner/smart-scan`.
3. Backend discovers sports, prioritizes FIFA World Cup, avoids invalid markets, and returns market intelligence.
4. UI groups candidates into readable buckets: World Cup, Moneyline, Totals, Spreads, Clean Markets, and Price Shopping.

This does not add EV or staking yet. `stakeSuggested` remains 0 until the consensus probability and EV layer is connected.
