import {
  MarketImportInput,
  MarketImportResult,
  MarketImportWarning,
  MarketSelection,
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketType,
} from './market-types';

const DEFAULT_EVENT_NAME = 'Imported Event';
const DEFAULT_MARKET_NAME = 'Unknown Market';

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function normalizeOddsToken(token: string): number | null {
  const normalized = token.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (value < 1.01 || value > 10000) return null;
  return value;
}

function extractLastDecimalOdd(line: string): { odds: number; oddsToken: string } | null {
  const matches = line.match(/(?:^|\s)(\d{1,4}[.,]\d{1,3})(?=\s|$)/g);
  if (!matches?.length) return null;

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const token = matches[index].trim();
    const odds = normalizeOddsToken(token);
    if (odds !== null) return { odds, oddsToken: token };
  }

  return null;
}

function looksLikeEventLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (lower.includes(' vs ') || lower.includes(' v ')) return true;
  if (/\b\w+\s+@\s+\w+\b/i.test(line)) return true;
  return false;
}

function normalizeMarketType(line: string): NormalizedMarketType | null {
  const lower = line.toLowerCase();

  if (lower.includes('moneyline') || lower.includes('ganador') || lower.includes('resultado') || lower === '1x2') return 'moneyline';
  if (lower.includes('spread') || lower.includes('handicap') || lower.includes('hándicap') || lower.includes('run line')) return 'spread';
  if (lower.includes('total') || lower.includes('over/under') || lower.includes('altas') || lower.includes('bajas')) return 'total';
  if (lower.includes('doble oportunidad') || lower.includes('double chance')) return 'double_chance';
  if (lower.includes('ambos anotan') || lower.includes('both teams')) return 'both_teams_score';
  if (lower.includes('tiros a puerta') || lower.includes('shots on target')) return 'player_shots_on_target';
  if (lower.includes('tiros') || lower.includes('shots')) return 'player_shots';
  if (lower.includes('atajadas') || lower.includes('saves')) return 'player_saves';
  if (lower.includes('tarjetas') || lower.includes('cards')) return 'cards';
  if (lower.includes('faltas') || lower.includes('fouls')) return 'fouls';
  if (lower.includes('corners') || lower.includes('tiros de esquina')) return 'corners';
  if (lower.includes('props') || lower.includes('jugador') || lower.includes('player')) return 'player_prop';

  return null;
}

function marketLabelFromType(type: NormalizedMarketType): string {
  const labels: Record<NormalizedMarketType, string> = {
    moneyline: 'Moneyline',
    spread: 'Spread / Handicap',
    total: 'Totals',
    double_chance: 'Double chance',
    both_teams_score: 'Both teams to score',
    player_shots: 'Player shots',
    player_shots_on_target: 'Shots on target',
    player_saves: 'Saves',
    cards: 'Cards',
    fouls: 'Fouls',
    corners: 'Corners',
    player_prop: 'Player props',
    unknown: DEFAULT_MARKET_NAME,
  };
  return labels[type];
}

function ensureEvent(events: NormalizedEvent[], eventName = DEFAULT_EVENT_NAME): NormalizedEvent {
  let event = events[events.length - 1];
  if (!event) {
    event = { eventName, markets: [] };
    events.push(event);
  }
  return event;
}

function ensureMarket(event: NormalizedEvent, type: NormalizedMarketType = 'unknown', displayName?: string): NormalizedMarket {
  let market = event.markets[event.markets.length - 1];
  if (!market || (type !== 'unknown' && market.marketType !== type)) {
    market = {
      marketType: type,
      displayName: displayName ?? marketLabelFromType(type),
      selections: [],
    };
    event.markets.push(market);
  }
  return market;
}

function selectionLabelFromLine(line: string, oddsToken: string): string {
  return line.replace(oddsToken, '').replace(/[@+-]?\d{1,4}[.,]\d{1,3}\s*$/, '').replace(/\s+$/, '').trim() || 'Selection';
}

export function importMarketsFromText(input: MarketImportInput): MarketImportResult {
  if (!input.rawText?.trim()) {
    throw new Error('rawText is required. Paste visible real markets first.');
  }

  const events: NormalizedEvent[] = [];
  const warnings: MarketImportWarning[] = [];

  const lines = input.rawText.split(/\r?\n/).map(cleanLine);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (!line) return;

    if (looksLikeEventLine(line)) {
      events.push({ eventName: line, markets: [] });
      return;
    }

    const marketType = normalizeMarketType(line);
    if (marketType !== null) {
      const event = ensureEvent(events);
      event.markets.push({
        marketType,
        displayName: marketLabelFromType(marketType),
        selections: [],
      });
      return;
    }

    const oddsMatch = extractLastDecimalOdd(line);
    if (oddsMatch) {
      const event = ensureEvent(events);
      const market = ensureMarket(event);
      const selection: MarketSelection = {
        label: selectionLabelFromLine(line, oddsMatch.oddsToken),
        oddsDecimal: Math.round(oddsMatch.odds * 1000) / 1000,
        rawLine: line,
      };
      market.selections.push(selection);
      return;
    }

    warnings.push({
      lineNumber,
      line,
      message: 'Line ignored: it was not recognized as event, market header, or selection with decimal odds.',
    });
  });

  events.forEach((event) => {
    event.markets = event.markets.filter((market) => market.selections.length > 0);
  });

  const cleanEvents = events.filter((event) => event.markets.length > 0);
  const marketCount = cleanEvents.reduce((sum, event) => sum + event.markets.length, 0);
  const selectionCount = cleanEvents.reduce(
    (sum, event) => sum + event.markets.reduce((marketSum, market) => marketSum + market.selections.length, 0),
    0,
  );

  return {
    source: input.source ?? 'draftea_visible',
    sport: input.sport?.trim() || 'unknown',
    league: input.league?.trim() || 'unknown',
    importedAt: new Date().toISOString(),
    events: cleanEvents,
    warnings,
    totals: {
      events: cleanEvents.length,
      markets: marketCount,
      selections: selectionCount,
    },
  };
}
