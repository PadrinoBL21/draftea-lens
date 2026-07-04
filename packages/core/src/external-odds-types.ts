import { NormalizedMarketType } from './market-types';

export type ExternalOddsProvider = 'the-odds-api';

export type ExternalOddsSourceQuery = {
  provider: ExternalOddsProvider;
  sportKey: string;
  regions?: string;
  markets?: string;
  bookmakers?: string;
  oddsFormat?: 'decimal' | 'american';
};

export type TheOddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
  description?: string;
  link?: string;
  sid?: string;
};

export type TheOddsApiMarket = {
  key: string;
  last_update?: string;
  outcomes: TheOddsApiOutcome[];
  link?: string;
  sid?: string;
};

export type TheOddsApiBookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: TheOddsApiMarket[];
  link?: string;
  sid?: string;
};

export type TheOddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: TheOddsApiBookmaker[];
};

export type NormalizedExternalSelection = {
  source: ExternalOddsProvider;
  sourceEventId: string;
  sourceSportKey: string;
  eventName: string;
  commenceTime: string;
  homeTeam?: string;
  awayTeam?: string;
  bookmakerKey: string;
  bookmakerTitle: string;
  bookmakerLastUpdate: string;
  marketKey: string;
  marketType: NormalizedMarketType;
  selection: string;
  oddsDecimal: number;
  point?: number;
  description?: string;
  link?: string;
  sid?: string;
};

export type ExternalOddsNormalizeResult = {
  provider: ExternalOddsProvider;
  normalizedAt: string;
  events: number;
  selections: number;
  markets: NormalizedExternalSelection[];
};
