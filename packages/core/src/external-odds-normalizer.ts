import {
  ExternalOddsNormalizeResult,
  NormalizedExternalSelection,
  TheOddsApiEvent,
} from './external-odds-types';
import { NormalizedMarketType } from './market-types';

export function americanToDecimal(americanOdds: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new Error('americanOdds must be a non-zero number.');
  }

  if (americanOdds > 0) {
    return round(1 + americanOdds / 100, 3);
  }

  return round(1 + 100 / Math.abs(americanOdds), 3);
}

export function normalizeOddsPrice(price: number, oddsFormat: 'decimal' | 'american' = 'decimal'): number {
  if (!Number.isFinite(price)) {
    throw new Error('price must be a finite number.');
  }

  if (oddsFormat === 'american') {
    return americanToDecimal(price);
  }

  return round(price, 3);
}

export function mapExternalMarketType(marketKey: string): NormalizedMarketType {
  const key = marketKey.toLowerCase().trim();

  if (key === 'h2h' || key === 'h2h_3_way' || key.startsWith('h2h_')) return 'moneyline';
  if (key === 'spreads' || key.startsWith('spreads_') || key.startsWith('alternate_spreads')) return 'spread';
  if (key === 'totals' || key.startsWith('totals_') || key.startsWith('alternate_totals')) return 'total';
  if (key === 'btts') return 'both_teams_score';
  if (key === 'draw_no_bet') return 'moneyline';
  if (key.includes('corner')) return 'corners';
  if (key.includes('card')) return 'cards';
  if (key.includes('shot_on_target') || key.includes('shots_on_target')) return 'player_shots_on_target';
  if (key.includes('shot') || key.includes('shots')) return 'player_shots';
  if (key.includes('save') || key.includes('saves')) return 'player_saves';
  if (key.includes('foul') || key.includes('fouls')) return 'fouls';
  if (key.includes('player')) return 'player_prop';

  return 'unknown';
}

export function buildEventName(event: TheOddsApiEvent): string {
  if (event.away_team && event.home_team) {
    return `${event.away_team} vs ${event.home_team}`;
  }

  return event.sport_title ?? event.sport_key;
}

export function normalizeTheOddsApiEvents(
  events: TheOddsApiEvent[],
  oddsFormat: 'decimal' | 'american' = 'decimal',
): ExternalOddsNormalizeResult {
  const markets: NormalizedExternalSelection[] = [];

  for (const event of events) {
    const eventName = buildEventName(event);

    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          markets.push({
            source: 'the-odds-api',
            sourceEventId: event.id,
            sourceSportKey: event.sport_key,
            eventName,
            commenceTime: event.commence_time,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            bookmakerKey: bookmaker.key,
            bookmakerTitle: bookmaker.title,
            bookmakerLastUpdate: bookmaker.last_update,
            marketKey: market.key,
            marketType: mapExternalMarketType(market.key),
            selection: outcome.name,
            oddsDecimal: normalizeOddsPrice(outcome.price, oddsFormat),
            point: outcome.point,
            description: outcome.description,
            link: outcome.link ?? market.link,
            sid: outcome.sid ?? market.sid,
          });
        }
      }
    }
  }

  return {
    provider: 'the-odds-api',
    normalizedAt: new Date().toISOString(),
    events: events.length,
    selections: markets.length,
    markets,
  };
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
