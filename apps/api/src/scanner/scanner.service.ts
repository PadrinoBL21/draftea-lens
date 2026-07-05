import { analyzeConsensusEv } from '@draftea-lens/core';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AutoScanDto } from './dto/auto-scan.dto';
import { SmartScanDto } from './dto/smart-scan.dto';
import { AutoScanCandidate, AutoScanResult, OddsApiUsage, ScannerRecommendation } from './scanner.types';

type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

type OddsApiMarket = {
  key: string;
  last_update?: string;
  outcomes: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsApiMarket[];
};

type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers: OddsApiBookmaker[];
};

type OddsApiSport = {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights?: boolean;
};

type SelectionBucket = {
  event: OddsApiEvent;
  marketKey: string;
  selection: string;
  point?: number;
  prices: Array<{
    bookmakerKey: string;
    bookmakerTitle: string;
    oddsDecimal: number;
    impliedProbability: number;
    noVigProbability: number | null;
    holdPct: number | null;
  }>;
};

type SportScanPlan = {
  key: string;
  title: string;
  group: string;
  markets: string;
};

type SportScanResult = {
  plan: SportScanPlan;
  events: OddsApiEvent[];
  usage: OddsApiUsage;
  marketsRequested: string;
  status: 'ok' | 'degraded' | 'skipped' | 'failed';
  note?: string;
};

const BASE_URL = 'https://api.the-odds-api.com/v4';

@Injectable()
export class ScannerService {
  async autoScan(dto: AutoScanDto): Promise<AutoScanResult> {
    const apiKey = this.getApiKey();

    const bankroll = Number(dto.bankroll);
    const sport = dto.sport;
    const regions = dto.regions || 'us';
    const markets = dto.markets || 'h2h,spreads,totals';
    const oddsFormat = dto.oddsFormat || 'decimal';
    const maxResults = dto.maxResults || 20;
    const minBookmakers = dto.minBookmakers || 2;

    const url = new URL(`${BASE_URL}/sports/${encodeURIComponent(sport)}/odds/`);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('regions', regions);
    url.searchParams.set('markets', markets);
    url.searchParams.set('oddsFormat', oddsFormat);

    if (dto.bookmakers) {
      url.searchParams.set('bookmakers', dto.bookmakers);
    }

    const response = await fetch(url);
    const usage = this.extractUsage(response.headers);

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(`The Odds API request failed: ${response.status} ${text}`);
    }

    const rawEvents = (await response.json()) as OddsApiEvent[];
    const allCandidates = this.buildCandidates(rawEvents, minBookmakers, bankroll).sort((a, b) => b.score - a.score);
    const candidates = allCandidates.slice(0, maxResults);
    const valueCandidates = candidates.filter((candidate) => candidate.recommendation === 'value_candidate').length;
    const watchCandidates = candidates.filter((candidate) => candidate.recommendation === 'watch').length;

    const warnings = [
      'Auto Scanner v0.2 uses consensus EV from market prices. It is not a neural network or proprietary predictive model yet.',
      'Stake suggestions are conservative and capped. Use them as decision support, not automatic betting instructions.',
      'A real model layer and backtesting are still required before trusting larger stakes.',
    ];

    return {
      scanner: 'auto_scanner_v0_1',
      mode: 'market_intelligence_consensus_ev',
      scannedAt: new Date().toISOString(),
      query: {
        bankroll,
        sport,
        regions,
        markets,
        bookmakers: dto.bookmakers,
        oddsFormat,
        maxResults,
        minBookmakers,
      },
      usage,
      totals: {
        rawEvents: rawEvents.length,
        candidates: allCandidates.length,
        returned: candidates.length,
        valueCandidates,
        watchCandidates,
      },
      warnings,
      candidates,
      summary: {
        recommendation: valueCandidates > 0 ? 'value_candidates_found' : candidates.length > 0 ? 'watchlist_ready' : 'no_candidates',
        message:
          valueCandidates > 0
            ? `Found ${valueCandidates} consensus value candidate(s). Review before staking.`
            : candidates.length > 0
              ? `Found ${candidates.length} candidates. No clean consensus value stake yet.`
              : 'No usable candidates found with the current filters.',
      },
    };
  }

  async smartScan(dto: SmartScanDto): Promise<AutoScanResult> {
    this.getApiKey();

    const bankroll = Number(dto.bankroll);
    const regions = dto.regions || 'us';
    const oddsFormat = dto.oddsFormat || 'decimal';
    const maxResults = dto.maxResults || this.defaultMaxResultsForBankroll(bankroll);
    const minBookmakers = dto.minBookmakers || 2;
    const sportLimit = dto.sportLimit || this.defaultSportLimitForBankroll(bankroll);
    const hoursAhead = dto.hoursAhead || this.defaultHoursAheadForBankroll(bankroll);
    const scannedAt = new Date().toISOString();

    const sportsResponse = await this.request<OddsApiSport[]>('/sports', {});
    const activeSports = sportsResponse.data.filter((sport) => sport.active);
    const plans = this.buildSportPlans(activeSports, sportLimit);

    const now = new Date();
    const to = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const commenceTimeFrom = this.toOddsApiDateTime(now);
    const commenceTimeTo = this.toOddsApiDateTime(to);

    const sportResults: SportScanResult[] = [];
    const warnings: string[] = [
      'Smart Scanner v0.2 discovers active sports and scans safe base markets automatically.',
      'Consensus EV is based on market prices with vig removed; it is not a neural network yet.',
      'Stake suggestions are conservative and capped until real model probabilities and backtesting are connected.',
    ];

    for (const plan of plans) {
      const result = await this.scanSportPlan(plan, {
        regions,
        bookmakers: dto.bookmakers,
        oddsFormat,
        commenceTimeFrom,
        commenceTimeTo,
      });

      sportResults.push(result);

      if ((result.status === 'degraded' || result.status === 'failed') && result.note) {
        warnings.push(`${plan.title}: ${result.note}`);
      }
    }

    const rawEvents = sportResults.flatMap((result) => result.events);
    const allCandidates = this.buildCandidates(rawEvents, minBookmakers, bankroll).sort((a, b) => b.score - a.score);
    const candidates = allCandidates.slice(0, maxResults);
    const valueCandidates = candidates.filter((candidate) => candidate.recommendation === 'value_candidate').length;
    const watchCandidates = candidates.filter((candidate) => candidate.recommendation === 'watch').length;
    const usage = this.mergeUsage([sportsResponse.usage, ...sportResults.map((result) => result.usage)]);
    const successfulPlans = sportResults.filter((result) => result.status === 'ok' || result.status === 'degraded');

    return {
      scanner: 'smart_catalog_scanner_v0_1',
      mode: 'market_intelligence_consensus_ev',
      scannedAt,
      query: {
        bankroll,
        sports: successfulPlans.map((result) => result.plan.key),
        regions,
        markets: 'catalog_discovered_base_markets',
        bookmakers: dto.bookmakers,
        oddsFormat,
        maxResults,
        minBookmakers,
        sportLimit,
        hoursAhead,
      },
      usage,
      totals: {
        rawEvents: rawEvents.length,
        candidates: allCandidates.length,
        returned: candidates.length,
        scannedSports: successfulPlans.length,
        activeSports: activeSports.length,
        valueCandidates,
        watchCandidates,
      },
      catalog: {
        source: 'the-odds-api',
        discoveredAt: scannedAt,
        activeSports: activeSports.length,
        scannedSports: sportResults.map((result) => ({
          key: result.plan.key,
          title: result.plan.title,
          group: result.plan.group,
          marketsRequested: result.marketsRequested,
          eventsReturned: result.events.length,
          status: result.status,
          note: result.note,
        })),
      },
      warnings,
      candidates,
      summary: {
        recommendation: valueCandidates > 0 ? 'value_candidates_found' : candidates.length > 0 ? 'watchlist_ready' : 'no_candidates',
        message:
          valueCandidates > 0
            ? `Smart scan found ${valueCandidates} consensus value candidate(s) from ${successfulPlans.length} sport source(s).`
            : candidates.length > 0
              ? `Smart scan found ${candidates.length} candidates from ${successfulPlans.length} sport source(s). No clean consensus value stake yet.`
              : 'Smart scan did not find usable candidates in the current window.',
      },
    };
  }

  private async scanSportPlan(
    plan: SportScanPlan,
    options: {
      regions: string;
      bookmakers?: string;
      oddsFormat: 'decimal' | 'american';
      commenceTimeFrom: string;
      commenceTimeTo: string;
    },
  ): Promise<SportScanResult> {
    const requestedMarkets = plan.markets;

    try {
      const response = await this.request<OddsApiEvent[]>(`/sports/${encodeURIComponent(plan.key)}/odds`, {
        regions: options.regions,
        markets: requestedMarkets,
        bookmakers: options.bookmakers,
        oddsFormat: options.oddsFormat,
        dateFormat: 'iso',
        commenceTimeFrom: options.commenceTimeFrom,
        commenceTimeTo: options.commenceTimeTo,
        includeLinks: 'true',
        includeSids: 'true',
      });

      return {
        plan,
        events: response.data,
        usage: response.usage,
        marketsRequested: requestedMarkets,
        status: 'ok',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetryH2hOnly = requestedMarkets !== 'h2h' && requestedMarkets !== 'outrights' && message.includes('INVALID_MARKET');

      if (!shouldRetryH2hOnly) {
        return {
          plan,
          events: [],
          usage: this.emptyUsage(),
          marketsRequested: requestedMarkets,
          status: 'failed',
          note: this.cleanError(message),
        };
      }

      try {
        const fallback = await this.request<OddsApiEvent[]>(`/sports/${encodeURIComponent(plan.key)}/odds`, {
          regions: options.regions,
          markets: 'h2h',
          bookmakers: options.bookmakers,
          oddsFormat: options.oddsFormat,
          dateFormat: 'iso',
          commenceTimeFrom: options.commenceTimeFrom,
          commenceTimeTo: options.commenceTimeTo,
          includeLinks: 'true',
          includeSids: 'true',
        });

        return {
          plan,
          events: fallback.data,
          usage: fallback.usage,
          marketsRequested: 'h2h',
          status: 'degraded',
          note: `Some requested markets were unavailable for this endpoint, so it retried with h2h only. Original error: ${this.cleanError(message)}`,
        };
      } catch (fallbackError) {
        return {
          plan,
          events: [],
          usage: this.emptyUsage(),
          marketsRequested: 'h2h',
          status: 'failed',
          note: this.cleanError(fallbackError instanceof Error ? fallbackError.message : String(fallbackError)),
        };
      }
    }
  }

  private buildSportPlans(activeSports: OddsApiSport[], sportLimit: number): SportScanPlan[] {
    const picked = activeSports
      .filter((sport) => sport.active)
      .filter((sport) => {
        if (!sport.has_outrights) return true;
        return this.isTeamSportKey(sport.key) || this.isPriorityTournamentSport(sport);
      })
      .map((sport) => ({
        sport,
        score: this.sportPriorityScore(sport),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, sportLimit)
      .map((item) => item.sport);

    return picked.map((sport) => ({
      key: sport.key,
      title: sport.title,
      group: sport.group,
      markets: this.defaultMarketsForSport(sport),
    }));
  }

  private sportPriorityScore(sport: OddsApiSport): number {
    const text = `${sport.key} ${sport.title} ${sport.description ?? ''}`.toLowerCase();
    const isSoccer = sport.group?.toLowerCase() === 'soccer';
    const isFifaWorldCup =
      isSoccer &&
      (text.includes('fifa world cup') || text.includes('soccer_fifa_world_cup') || text.includes('world cup'));
    const isWorldCupWinner =
      isSoccer &&
      (text.includes('fifa world cup winner') || text.includes('soccer_fifa_world_cup_winner') || sport.key.endsWith('_winner'));

    let score = 0;

    if (isFifaWorldCup && !isWorldCupWinner) score += 2000;
    if (isWorldCupWinner) score += 1500;

    if (isSoccer && text.includes('copa')) score += 850;
    if (isSoccer && text.includes('international')) score += 750;
    if (isSoccer && text.includes('concacaf')) score += 700;
    if (isSoccer && text.includes('uefa')) score += 650;
    if (isSoccer && text.includes('champions league')) score += 640;

    if (!isSoccer && text.includes('world cup')) score += 250;

    if (sport.key === 'baseball_mlb') score += 600;
    if (sport.key === 'basketball_nba') score += 580;
    if (sport.key === 'americanfootball_nfl') score += 560;
    if (sport.key === 'icehockey_nhl') score += 520;

    if (sport.key.includes('soccer_mexico_ligamx')) score += 500;
    if (sport.key.includes('soccer_usa_mls')) score += 420;
    if (sport.key.includes('soccer_epl')) score += 400;
    if (sport.key.includes('soccer_spain_la_liga')) score += 380;
    if (sport.key.includes('soccer_italy_serie_a')) score += 360;
    if (sport.key.includes('soccer_germany_bundesliga')) score += 340;
    if (sport.key.includes('soccer_france_ligue_one')) score += 320;

    if (isSoccer) score += 250;
    if (this.isTeamSportKey(sport.key)) score += 100;
    if (sport.has_outrights) score -= 50;

    return score;
  }

  private isPriorityTournamentSport(sport: OddsApiSport): boolean {
    const text = `${sport.key} ${sport.title} ${sport.description ?? ''}`.toLowerCase();

    return (
      text.includes('world cup') ||
      text.includes('fifa') ||
      text.includes('mundial') ||
      text.includes('copa') ||
      text.includes('international') ||
      text.includes('concacaf') ||
      text.includes('uefa') ||
      text.includes('champions league')
    );
  }

  private defaultMarketsForSport(sport: OddsApiSport): string {
    const text = `${sport.key} ${sport.title} ${sport.description ?? ''}`.toLowerCase();
    const isOutrightOnly = text.includes('_winner') || text.includes(' winner') || sport.key.endsWith('_winner');

    if (isOutrightOnly) return 'outrights';

    if (sport.key.includes('mma') || sport.key.includes('boxing')) return 'h2h';

    if (
      sport.group?.toLowerCase() === 'soccer' ||
      sport.key.includes('baseball') ||
      sport.key.includes('basketball') ||
      sport.key.includes('americanfootball') ||
      sport.key.includes('icehockey') ||
      sport.key.includes('cricket')
    ) {
      return 'h2h,spreads,totals';
    }

    return 'h2h';
  }

  private defaultSportLimitForBankroll(bankroll: number): number {
    if (bankroll <= 100) return 4;
    if (bankroll <= 500) return 6;
    return 8;
  }

  private defaultMaxResultsForBankroll(bankroll: number): number {
    if (bankroll <= 100) return 15;
    if (bankroll <= 500) return 25;
    return 40;
  }

  private defaultHoursAheadForBankroll(bankroll: number): number {
    if (bankroll <= 100) return 24;
    if (bankroll <= 500) return 48;
    return 72;
  }

  private isTeamSportKey(sportKey: string): boolean {
    return (
      sportKey.includes('baseball') ||
      sportKey.includes('basketball') ||
      sportKey.includes('americanfootball') ||
      sportKey.includes('icehockey') ||
      sportKey.includes('soccer') ||
      sportKey.includes('rugby') ||
      sportKey.includes('cricket')
    );
  }

  private buildCandidates(events: OddsApiEvent[], minBookmakers: number, bankroll: number): AutoScanCandidate[] {
    const buckets = new Map<string, SelectionBucket>();

    for (const event of events) {
      for (const bookmaker of event.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          const marketOverround = this.calculateMarketOverround(market);
          const marketHoldPct = marketOverround === null ? null : this.round(Math.max(0, marketOverround - 1), 4);

          for (const outcome of market.outcomes || []) {
            const oddsDecimal = Number(outcome.price);
            if (!Number.isFinite(oddsDecimal) || oddsDecimal <= 1) continue;

            const impliedProbability = 1 / oddsDecimal;
            const noVigProbability = marketOverround && marketOverround > 0 ? impliedProbability / marketOverround : null;
            const bucketKey = [event.id, market.key, outcome.name, outcome.point ?? 'no-point'].join('|');

            if (!buckets.has(bucketKey)) {
              buckets.set(bucketKey, {
                event,
                marketKey: market.key,
                selection: outcome.name,
                point: outcome.point,
                prices: [],
              });
            }

            buckets.get(bucketKey)!.prices.push({
              bookmakerKey: bookmaker.key,
              bookmakerTitle: bookmaker.title,
              oddsDecimal,
              impliedProbability,
              noVigProbability,
              holdPct: marketHoldPct,
            });
          }
        }
      }
    }

    const candidates: AutoScanCandidate[] = [];

    for (const bucket of buckets.values()) {
      const uniqueBookmakers = new Set(bucket.prices.map((price) => price.bookmakerKey));
      if (uniqueBookmakers.size < minBookmakers) continue;

      const sortedPrices = [...bucket.prices].sort((a, b) => b.oddsDecimal - a.oddsDecimal);
      const best = sortedPrices[0];
      const worst = sortedPrices[sortedPrices.length - 1];
      const averageOdds = this.round(sortedPrices.reduce((sum, price) => sum + price.oddsDecimal, 0) / sortedPrices.length, 4);
      const priceSpreadPct = worst.oddsDecimal > 0 ? this.round((best.oddsDecimal - worst.oddsDecimal) / worst.oddsDecimal, 4) : 0;
      const bestHoldPct = best.holdPct;
      const noVigProbabilities = sortedPrices
        .map((price) => price.noVigProbability)
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const consensusProbability = noVigProbabilities.length
        ? this.round(noVigProbabilities.reduce((sum, value) => sum + value, 0) / noVigProbabilities.length, 4)
        : this.round(1 / averageOdds, 4);

      const marketType = this.mapMarketType(bucket.marketKey);
      const ev = analyzeConsensusEv({
        bankroll,
        bestOddsDecimal: best.oddsDecimal,
        consensusProbabilityNoVig: consensusProbability,
        impliedProbabilityBest: 1 / best.oddsDecimal,
        bookmakerCount: uniqueBookmakers.size,
        marketHoldPct: bestHoldPct,
        marketType,
      });

      const marketIntelRecommendation = this.marketIntelRecommendation(priceSpreadPct, bestHoldPct, uniqueBookmakers.size);
      const recommendation = this.finalRecommendation(ev.decision, marketIntelRecommendation);
      const score = this.scoreCandidate(priceSpreadPct, bestHoldPct, uniqueBookmakers.size, ev.expectedValuePerUnit, recommendation);
      const reasons = this.explainCandidate(priceSpreadPct, bestHoldPct, uniqueBookmakers.size, recommendation, ev.reasons);

      candidates.push({
        eventId: bucket.event.id,
        eventName: this.eventName(bucket.event),
        commenceTime: bucket.event.commence_time,
        sportKey: bucket.event.sport_key,
        marketKey: bucket.marketKey,
        marketType,
        selection: bucket.selection,
        point: bucket.point,
        bestOddsDecimal: this.round(best.oddsDecimal, 4),
        bestBookmaker: best.bookmakerTitle || best.bookmakerKey,
        worstOddsDecimal: this.round(worst.oddsDecimal, 4),
        averageOddsDecimal: averageOdds,
        impliedProbabilityBest: this.round(1 / best.oddsDecimal, 4),
        consensusImpliedProbability: this.round(1 / averageOdds, 4),
        consensusProbability: ev.consensusProbability,
        fairOddsConsensus: ev.fairOddsConsensus,
        edgeVsConsensus: ev.edgeVsConsensus,
        expectedValuePerUnit: ev.expectedValuePerUnit,
        kellyFull: ev.kellyFull,
        kellyFractional: ev.kellyFractional,
        bookmakerCount: uniqueBookmakers.size,
        priceSpreadPct,
        bestBookmakerHoldPct: bestHoldPct,
        score,
        recommendation,
        stakeSuggested: ev.stakeSuggested,
        reasons,
      });
    }

    return candidates;
  }

  private calculateMarketOverround(market: OddsApiMarket): number | null {
    if (!market.outcomes || market.outcomes.length < 2) return null;

    const impliedSum = market.outcomes.reduce((sum, outcome) => {
      const odds = Number(outcome.price);
      if (!Number.isFinite(odds) || odds <= 1) return sum;
      return sum + 1 / odds;
    }, 0);

    if (impliedSum <= 0) return null;
    return impliedSum;
  }

  private scoreCandidate(
    priceSpreadPct: number,
    holdPct: number | null,
    bookmakerCount: number,
    expectedValuePerUnit: number,
    recommendation: ScannerRecommendation,
  ): number {
    const spreadScore = priceSpreadPct * 100;
    const liquidityScore = Math.min(bookmakerCount, 10) * 0.5;
    const holdPenalty = holdPct === null ? 3 : holdPct * 100;
    const evScore = Math.max(0, expectedValuePerUnit) * 85;
    const valueBonus = recommendation === 'value_candidate' ? 8 : recommendation === 'watch' ? 2 : 0;

    return this.round(spreadScore + liquidityScore - holdPenalty + evScore + valueBonus, 4);
  }

  private marketIntelRecommendation(priceSpreadPct: number, holdPct: number | null, bookmakerCount: number): ScannerRecommendation {
    if (bookmakerCount < 2) return 'skip';
    if (priceSpreadPct >= 0.04 && bookmakerCount >= 3) return 'price_shopping_candidate';
    if (holdPct !== null && holdPct <= 0.04 && bookmakerCount >= 2) return 'clean_market_candidate';
    return 'watch';
  }

  private finalRecommendation(
    evDecision: 'value_candidate' | 'watch' | 'no_bet',
    marketIntelRecommendation: ScannerRecommendation,
  ): ScannerRecommendation {
    if (evDecision === 'value_candidate') return 'value_candidate';
    if (evDecision === 'watch') return marketIntelRecommendation === 'skip' ? 'watch' : marketIntelRecommendation;
    return marketIntelRecommendation === 'watch' ? 'no_bet' : marketIntelRecommendation;
  }

  private explainCandidate(
    priceSpreadPct: number,
    holdPct: number | null,
    bookmakerCount: number,
    recommendation: ScannerRecommendation,
    evReasons: string[],
  ): string[] {
    const reasons: string[] = [];

    if (recommendation === 'value_candidate') {
      reasons.push('Consensus market EV suggests this is a value candidate.');
    }

    if (recommendation === 'price_shopping_candidate') {
      reasons.push('Best price is meaningfully higher than the worst available price.');
    }

    if (recommendation === 'clean_market_candidate') {
      reasons.push('Market hold is relatively low compared with typical recreational pricing.');
    }

    if (recommendation === 'watch') {
      reasons.push('Candidate is worth monitoring, but the consensus value signal is not clean enough yet.');
    }

    if (recommendation === 'no_bet') {
      reasons.push('Consensus EV does not justify a stake right now.');
    }

    reasons.push(`Available across ${bookmakerCount} bookmaker(s).`);
    reasons.push(`Price spread: ${(priceSpreadPct * 100).toFixed(2)}%.`);

    if (holdPct !== null) {
      reasons.push(`Best-bookmaker market hold: ${(holdPct * 100).toFixed(2)}%.`);
    } else {
      reasons.push('Market hold could not be calculated for this market.');
    }

    return [...reasons, ...evReasons];
  }

  private mapMarketType(marketKey: string): string {
    const map: Record<string, string> = {
      h2h: 'moneyline',
      spreads: 'spread',
      totals: 'total',
      outrights: 'outright',
      btts: 'both_teams_to_score',
      draw_no_bet: 'draw_no_bet',
      alternate_spreads: 'alternate_spread',
      alternate_totals: 'alternate_total',
    };

    return map[marketKey] || marketKey;
  }

  private eventName(event: OddsApiEvent): string {
    if (event.away_team && event.home_team) return `${event.away_team} vs ${event.home_team}`;
    if (event.sport_title) return event.sport_title;
    return event.id;
  }

  private toOddsApiDateTime(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private getApiKey(): string {
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('THE_ODDS_API_KEY is not configured. Set it before running the API.');
    }
    return apiKey;
  }

  private async request<T = unknown>(path: string, params: Record<string, string | undefined>): Promise<{ usage: OddsApiUsage; data: T }> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('apiKey', this.getApiKey());

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url);
    const usage = this.extractUsage(response.headers);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`The Odds API request failed: ${response.status} ${response.statusText} - ${body}`);
    }

    return {
      usage,
      data: (await response.json()) as T,
    };
  }

  private mergeUsage(items: OddsApiUsage[]): OddsApiUsage {
    const filtered = items.filter(Boolean);
    const last = [...filtered].reverse().find((item) => item.requestsRemaining !== null || item.requestsUsed !== null);
    const requestsLast = filtered.reduce((sum, item) => sum + (item.requestsLast ?? 0), 0);

    return {
      requestsRemaining: last?.requestsRemaining ?? null,
      requestsUsed: last?.requestsUsed ?? null,
      requestsLast: requestsLast > 0 ? requestsLast : null,
    };
  }

  private extractUsage(headers: Headers): OddsApiUsage {
    return {
      requestsRemaining: this.headerNumber(headers, 'x-requests-remaining'),
      requestsUsed: this.headerNumber(headers, 'x-requests-used'),
      requestsLast: this.headerNumber(headers, 'x-requests-last'),
    };
  }

  private headerNumber(headers: Headers, key: string): number | null {
    const value = headers.get(key);
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private emptyUsage(): OddsApiUsage {
    return {
      requestsRemaining: null,
      requestsUsed: null,
      requestsLast: null,
    };
  }

  private cleanError(message: string): string {
    return message.replace(/apiKey=[^&\s]+/g, 'apiKey=***').slice(0, 280);
  }

  private round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
