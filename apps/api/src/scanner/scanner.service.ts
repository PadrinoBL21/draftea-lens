import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AutoScanDto } from './dto/auto-scan.dto';
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
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
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
    holdPct: number | null;
  }>;
};

@Injectable()
export class ScannerService {
  async autoScan(dto: AutoScanDto): Promise<AutoScanResult> {
    const apiKey = process.env.THE_ODDS_API_KEY;

    if (!apiKey) {
      throw new BadRequestException('THE_ODDS_API_KEY is not configured. Set it before running the API.');
    }

    const bankroll = Number(dto.bankroll);
    const sport = dto.sport;
    const regions = dto.regions || 'us';
    const markets = dto.markets || 'h2h,spreads,totals';
    const oddsFormat = dto.oddsFormat || 'decimal';
    const maxResults = dto.maxResults || 20;
    const minBookmakers = dto.minBookmakers || 2;

    const url = new URL(`https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/odds/`);
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
    const candidates = this.buildCandidates(rawEvents, minBookmakers)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    const warnings = [
      'Auto Scanner v0.1 is market intelligence only. It does not calculate true EV yet.',
      'stakeSuggested is 0 until a predictive model is connected.',
      'Use these results as a watchlist, not as automatic betting instructions.',
    ];

    return {
      scanner: 'auto_scanner_v0_1',
      mode: 'market_intelligence_no_model_ev',
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
        candidates: this.countCandidateBuckets(rawEvents, minBookmakers),
        returned: candidates.length,
      },
      warnings,
      candidates,
      summary: {
        recommendation: candidates.length > 0 ? 'watchlist_ready' : 'no_candidates',
        message:
          candidates.length > 0
            ? `Found ${candidates.length} market intelligence candidates. Next step: connect model probabilities to calculate EV.`
            : 'No usable candidates found with the current filters.',
      },
    };
  }

  private buildCandidates(events: OddsApiEvent[], minBookmakers: number): AutoScanCandidate[] {
    const buckets = new Map<string, SelectionBucket>();

    for (const event of events) {
      for (const bookmaker of event.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          const marketHoldPct = this.calculateMarketHoldPct(market);

          for (const outcome of market.outcomes || []) {
            const oddsDecimal = Number(outcome.price);
            if (!Number.isFinite(oddsDecimal) || oddsDecimal <= 1) continue;

            const bucketKey = [
              event.id,
              market.key,
              outcome.name,
              outcome.point ?? 'no-point',
            ].join('|');

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
      const score = this.scoreCandidate(priceSpreadPct, bestHoldPct, uniqueBookmakers.size);
      const recommendation = this.recommend(priceSpreadPct, bestHoldPct, uniqueBookmakers.size);
      const reasons = this.explainCandidate(priceSpreadPct, bestHoldPct, uniqueBookmakers.size, recommendation);

      candidates.push({
        eventId: bucket.event.id,
        eventName: `${bucket.event.away_team} vs ${bucket.event.home_team}`,
        commenceTime: bucket.event.commence_time,
        sportKey: bucket.event.sport_key,
        marketKey: bucket.marketKey,
        marketType: this.mapMarketType(bucket.marketKey),
        selection: bucket.selection,
        point: bucket.point,
        bestOddsDecimal: this.round(best.oddsDecimal, 4),
        bestBookmaker: best.bookmakerTitle || best.bookmakerKey,
        worstOddsDecimal: this.round(worst.oddsDecimal, 4),
        averageOddsDecimal: averageOdds,
        impliedProbabilityBest: this.round(1 / best.oddsDecimal, 4),
        consensusImpliedProbability: this.round(1 / averageOdds, 4),
        bookmakerCount: uniqueBookmakers.size,
        priceSpreadPct,
        bestBookmakerHoldPct: bestHoldPct,
        score,
        recommendation,
        stakeSuggested: 0,
        reasons,
      });
    }

    return candidates;
  }

  private countCandidateBuckets(events: OddsApiEvent[], minBookmakers: number): number {
    return this.buildCandidates(events, minBookmakers).length;
  }

  private calculateMarketHoldPct(market: OddsApiMarket): number | null {
    if (!market.outcomes || market.outcomes.length < 2) return null;

    const impliedSum = market.outcomes.reduce((sum, outcome) => {
      const odds = Number(outcome.price);
      if (!Number.isFinite(odds) || odds <= 1) return sum;
      return sum + 1 / odds;
    }, 0);

    if (impliedSum <= 0) return null;
    return this.round(Math.max(0, impliedSum - 1), 4);
  }

  private scoreCandidate(priceSpreadPct: number, holdPct: number | null, bookmakerCount: number): number {
    const spreadScore = priceSpreadPct * 100;
    const liquidityScore = Math.min(bookmakerCount, 10) * 0.5;
    const holdPenalty = holdPct === null ? 3 : holdPct * 100;

    return this.round(spreadScore + liquidityScore - holdPenalty, 4);
  }

  private recommend(priceSpreadPct: number, holdPct: number | null, bookmakerCount: number): ScannerRecommendation {
    if (bookmakerCount < 2) return 'skip';
    if (priceSpreadPct >= 0.04 && bookmakerCount >= 3) return 'price_shopping_candidate';
    if (holdPct !== null && holdPct <= 0.04 && bookmakerCount >= 2) return 'clean_market_candidate';
    return 'watch';
  }

  private explainCandidate(
    priceSpreadPct: number,
    holdPct: number | null,
    bookmakerCount: number,
    recommendation: ScannerRecommendation,
  ): string[] {
    const reasons: string[] = [];

    if (recommendation === 'price_shopping_candidate') {
      reasons.push('Best price is meaningfully higher than the worst available price.');
    }

    if (recommendation === 'clean_market_candidate') {
      reasons.push('Market hold is relatively low compared with typical recreational pricing.');
    }

    if (recommendation === 'watch') {
      reasons.push('Candidate is worth monitoring, but no model edge is confirmed yet.');
    }

    reasons.push(`Available across ${bookmakerCount} bookmaker(s).`);
    reasons.push(`Price spread: ${(priceSpreadPct * 100).toFixed(2)}%.`);

    if (holdPct !== null) {
      reasons.push(`Best-bookmaker market hold: ${(holdPct * 100).toFixed(2)}%.`);
    } else {
      reasons.push('Market hold could not be calculated for this market.');
    }

    reasons.push('No stake suggested until model probability and EV are connected.');

    return reasons;
  }

  private mapMarketType(marketKey: string): string {
    const map: Record<string, string> = {
      h2h: 'moneyline',
      spreads: 'spread',
      totals: 'total',
      btts: 'both_teams_to_score',
      draw_no_bet: 'draw_no_bet',
    };

    return map[marketKey] || marketKey;
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

  private round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
