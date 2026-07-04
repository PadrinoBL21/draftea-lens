export type MarketSource = 'draftea_visible' | 'manual_import' | 'external_api' | 'unknown';

export type NormalizedMarketType =
  | 'moneyline'
  | 'spread'
  | 'total'
  | 'double_chance'
  | 'both_teams_score'
  | 'player_shots'
  | 'player_shots_on_target'
  | 'player_saves'
  | 'cards'
  | 'fouls'
  | 'corners'
  | 'player_prop'
  | 'unknown';

export type MarketSelection = {
  label: string;
  oddsDecimal: number;
  rawLine: string;
};

export type NormalizedMarket = {
  marketType: NormalizedMarketType;
  displayName: string;
  selections: MarketSelection[];
};

export type NormalizedEvent = {
  eventName: string;
  markets: NormalizedMarket[];
};

export type MarketImportInput = {
  rawText: string;
  sport?: string;
  league?: string;
  source?: MarketSource;
};

export type MarketImportWarning = {
  lineNumber: number;
  line: string;
  message: string;
};

export type MarketImportResult = {
  source: MarketSource;
  sport: string;
  league: string;
  importedAt: string;
  events: NormalizedEvent[];
  warnings: MarketImportWarning[];
  totals: {
    events: number;
    markets: number;
    selections: number;
  };
};
