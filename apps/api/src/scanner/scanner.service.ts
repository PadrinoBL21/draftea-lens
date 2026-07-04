import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { AutoScanDto } from "./dto/auto-scan.dto";
import { SmartScanDto } from "./dto/smart-scan.dto";
import {
  AutoScanCandidate,
  AutoScanResult,
  OddsApiUsage,
  ScannerRecommendation,
} from "./scanner.types";

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
  status: "ok" | "degraded" | "skipped" | "failed";
  note?: string;
};

const BASE_URL = "https://api.the-odds-api.com/v4";

@Injectable()
export class ScannerService {
  async autoScan(dto: AutoScanDto): Promise<AutoScanResult> {
    const apiKey = this.getApiKey();

    const bankroll = Number(dto.bankroll);
    const sport = dto.sport;
    const regions = dto.regions || "us";
    const markets = dto.markets || "h2h,spreads,totals";
    const oddsFormat = dto.oddsFormat || "decimal";
    const maxResults = dto.maxResults || 20;
    const minBookmakers = dto.minBookmakers || 2;

    const url = new URL(
      `${BASE_URL}/sports/${encodeURIComponent(sport)}/odds/`,
    );
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", regions);
    url.searchParams.set("markets", markets);
    url.searchParams.set("oddsFormat", oddsFormat);

    if (dto.bookmakers) {
      url.searchParams.set("bookmakers", dto.bookmakers);
    }

    const response = await fetch(url);
    const usage = this.extractUsage(response.headers);

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(
        `The Odds API request failed: ${response.status} ${text}`,
      );
    }

    const rawEvents = (await response.json()) as OddsApiEvent[];
    const allCandidates = this.buildCandidates(rawEvents, minBookmakers).sort(
      (a, b) => b.score - a.score,
    );
    const candidates = allCandidates.slice(0, maxResults);

    const warnings = [
      "Auto Scanner v0.1 is market intelligence only. It does not calculate true EV yet.",
      "stakeSuggested is 0 until a predictive model is connected.",
      "Use these results as a watchlist, not as automatic betting instructions.",
    ];

    return {
      scanner: "auto_scanner_v0_1",
      mode: "market_intelligence_no_model_ev",
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
      },
      warnings,
      candidates,
      summary: {
        recommendation:
          candidates.length > 0 ? "watchlist_ready" : "no_candidates",
        message:
          candidates.length > 0
            ? `Found ${candidates.length} market intelligence candidates. Next step: connect model probabilities to calculate EV.`
            : "No usable candidates found with the current filters.",
      },
    };
  }

  async smartScan(dto: SmartScanDto): Promise<AutoScanResult> {
    this.getApiKey();

    const bankroll = Number(dto.bankroll);
    const regions = dto.regions || "us";
    const oddsFormat = dto.oddsFormat || "decimal";
    const maxResults =
      dto.maxResults || this.defaultMaxResultsForBankroll(bankroll);
    const minBookmakers = dto.minBookmakers || 2;
    const sportLimit =
      dto.sportLimit || this.defaultSportLimitForBankroll(bankroll);
    const hoursAhead =
      dto.hoursAhead || this.defaultHoursAheadForBankroll(bankroll);
    const scannedAt = new Date().toISOString();

    const sportsResponse = await this.request<OddsApiSport[]>("/sports", {});
    const activeSports = sportsResponse.data.filter((sport) => sport.active);
    const plans = this.buildSportPlans(activeSports, sportLimit);

    function toOddsApiDateTime(date: Date): string {
      return date.toISOString().replace(/\.\d{3}Z$/, "Z");
    }

    const now = new Date();
    const to = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    const commenceTimeFrom = toOddsApiDateTime(now);
    const commenceTimeTo = toOddsApiDateTime(to);

    const sportResults: SportScanResult[] = [];
    const warnings: string[] = [
      "Smart Scanner v0.1 discovers active sports and scans safe base markets automatically.",
      "It avoids user-selected unsupported markets. Deep props will be added through a provider market catalog layer.",
      "stakeSuggested is 0 until model probability and EV are connected.",
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

      if (result.status === "degraded" && result.note) {
        warnings.push(`${plan.title}: ${result.note}`);
      }

      if (result.status === "failed" && result.note) {
        warnings.push(`${plan.title}: ${result.note}`);
      }
    }

    const rawEvents = sportResults.flatMap((result) => result.events);
    const allCandidates = this.buildCandidates(rawEvents, minBookmakers).sort(
      (a, b) => b.score - a.score,
    );
    const candidates = allCandidates.slice(0, maxResults);
    const usage = this.mergeUsage([
      sportsResponse.usage,
      ...sportResults.map((result) => result.usage),
    ]);
    const successfulPlans = sportResults.filter(
      (result) => result.status === "ok" || result.status === "degraded",
    );

    return {
      scanner: "smart_catalog_scanner_v0_1",
      mode: "market_intelligence_no_model_ev",
      scannedAt,
      query: {
        bankroll,
        sports: successfulPlans.map((result) => result.plan.key),
        regions,
        markets: "catalog_discovered_base_markets",
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
      },
      catalog: {
        source: "the-odds-api",
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
        recommendation:
          candidates.length > 0 ? "watchlist_ready" : "no_candidates",
        message:
          candidates.length > 0
            ? `Smart scan found ${candidates.length} candidates from ${successfulPlans.length} sport source(s).`
            : "Smart scan did not find usable candidates in the current window.",
      },
    };
  }

  private async scanSportPlan(
    plan: SportScanPlan,
    options: {
      regions: string;
      bookmakers?: string;
      oddsFormat: "decimal" | "american";
      commenceTimeFrom: string;
      commenceTimeTo: string;
    },
  ): Promise<SportScanResult> {
    const requestedMarkets = plan.markets;

    try {
      const response = await this.request<OddsApiEvent[]>(
        `/sports/${encodeURIComponent(plan.key)}/odds`,
        {
          regions: options.regions,
          markets: requestedMarkets,
          bookmakers: options.bookmakers,
          oddsFormat: options.oddsFormat,
          dateFormat: "iso",
          commenceTimeFrom: options.commenceTimeFrom,
          commenceTimeTo: options.commenceTimeTo,
          includeLinks: "true",
          includeSids: "true",
        },
      );

      return {
        plan,
        events: response.data,
        usage: response.usage,
        marketsRequested: requestedMarkets,
        status: "ok",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetryH2hOnly =
        requestedMarkets !== "h2h" && message.includes("INVALID_MARKET");

      if (!shouldRetryH2hOnly) {
        return {
          plan,
          events: [],
          usage: this.emptyUsage(),
          marketsRequested: requestedMarkets,
          status: "failed",
          note: this.cleanError(message),
        };
      }

      try {
        const fallback = await this.request<OddsApiEvent[]>(
          `/sports/${encodeURIComponent(plan.key)}/odds`,
          {
            regions: options.regions,
            markets: "h2h",
            bookmakers: options.bookmakers,
            oddsFormat: options.oddsFormat,
            dateFormat: "iso",
            commenceTimeFrom: options.commenceTimeFrom,
            commenceTimeTo: options.commenceTimeTo,
            includeLinks: "true",
            includeSids: "true",
          },
        );

        return {
          plan,
          events: fallback.data,
          usage: fallback.usage,
          marketsRequested: "h2h",
          status: "degraded",
          note: `Some requested markets were unavailable for this endpoint, so it retried with h2h only. Original error: ${this.cleanError(message)}`,
        };
      } catch (fallbackError) {
        return {
          plan,
          events: [],
          usage: this.emptyUsage(),
          marketsRequested: "h2h",
          status: "failed",
          note: this.cleanError(
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
          ),
        };
      }
    }
  }

  private buildSportPlans(
    activeSports: OddsApiSport[],
    sportLimit: number,
  ): SportScanPlan[] {
    const picked = activeSports
      .filter((sport) => sport.active)
      .filter((sport) => {
        if (!sport.has_outrights) return true;
        return (
          this.isTeamSportKey(sport.key) ||
          this.isPriorityTournamentSport(sport)
        );
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
    const text =
      `${sport.key} ${sport.title} ${sport.description ?? ""}`.toLowerCase();

    let score = 0;

    const isSoccer = sport.group?.toLowerCase() === "soccer";
    const isFifaWorldCup =
      isSoccer &&
      (text.includes("fifa world cup") ||
        text.includes("soccer_fifa_world_cup") ||
        text.includes("world cup"));

    const isWorldCupWinner =
      isSoccer &&
      (text.includes("fifa world cup winner") ||
        text.includes("soccer_fifa_world_cup_winner") ||
        sport.key.endsWith("_winner"));

    if (isFifaWorldCup && !isWorldCupWinner) score += 2000;
    if (isWorldCupWinner) score += 1500;

    // Torneos de futbol importantes
    if (isSoccer && text.includes("copa")) score += 850;
    if (isSoccer && text.includes("international")) score += 750;
    if (isSoccer && text.includes("concacaf")) score += 700;
    if (isSoccer && text.includes("uefa")) score += 650;
    if (isSoccer && text.includes("champions league")) score += 640;

    // Otros "World Cup" que no son futbol: sí importan, pero no arriba del Mundial FIFA
    if (!isSoccer && text.includes("world cup")) score += 250;

    // Deportes/ligas útiles para apuestas diarias
    if (sport.key === "baseball_mlb") score += 600;
    if (sport.key === "basketball_nba") score += 580;
    if (sport.key === "americanfootball_nfl") score += 560;
    if (sport.key === "icehockey_nhl") score += 520;

    // Futbol relevante para nosotros
    if (sport.key.includes("soccer_mexico_ligamx")) score += 500;
    if (sport.key.includes("soccer_usa_mls")) score += 420;
    if (sport.key.includes("soccer_epl")) score += 400;
    if (sport.key.includes("soccer_spain_la_liga")) score += 380;
    if (sport.key.includes("soccer_italy_serie_a")) score += 360;
    if (sport.key.includes("soccer_germany_bundesliga")) score += 340;
    if (sport.key.includes("soccer_france_ligue_one")) score += 320;

    // Fallback razonable
    if (sport.group?.toLowerCase() === "soccer") score += 250;
    if (this.isTeamSportKey(sport.key)) score += 100;
    if (sport.has_outrights) score -= 50;

    return score;
  }

  private isPriorityTournamentSport(sport: OddsApiSport): boolean {
    const text =
      `${sport.key} ${sport.title} ${sport.description ?? ""}`.toLowerCase();

    return (
      text.includes("world cup") ||
      text.includes("fifa") ||
      text.includes("mundial") ||
      text.includes("copa") ||
      text.includes("international") ||
      text.includes("concacaf") ||
      text.includes("uefa") ||
      text.includes("champions league")
    );
  }
  private defaultMarketsForSport(sport: OddsApiSport): string {
    const text =
      `${sport.key} ${sport.title} ${sport.description ?? ""}`.toLowerCase();

    const isOutrightOnly =
      text.includes("_winner") ||
      text.includes(" winner") ||
      sport.key.endsWith("_winner");

    if (isOutrightOnly) {
      return "outrights";
    }

    if (sport.group?.toLowerCase() === "soccer") {
      return "h2h,spreads,totals";
    }

    if (sport.key.includes("baseball")) {
      return "h2h,spreads,totals";
    }

    if (sport.key.includes("basketball")) {
      return "h2h,spreads,totals";
    }

    if (sport.key.includes("americanfootball")) {
      return "h2h,spreads,totals";
    }

    if (sport.key.includes("icehockey")) {
      return "h2h,spreads,totals";
    }

    return "h2h";
  }

  private defaultSportLimitForBankroll(bankroll: number): number {
    if (bankroll <= 100) return 3;
    if (bankroll <= 500) return 5;
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
      sportKey.includes("baseball") ||
      sportKey.includes("basketball") ||
      sportKey.includes("americanfootball") ||
      sportKey.includes("icehockey") ||
      sportKey.includes("soccer") ||
      sportKey.includes("rugby") ||
      sportKey.includes("cricket")
    );
  }

  private buildCandidates(
    events: OddsApiEvent[],
    minBookmakers: number,
  ): AutoScanCandidate[] {
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
              outcome.point ?? "no-point",
            ].join("|");

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
      const uniqueBookmakers = new Set(
        bucket.prices.map((price) => price.bookmakerKey),
      );
      if (uniqueBookmakers.size < minBookmakers) continue;

      const sortedPrices = [...bucket.prices].sort(
        (a, b) => b.oddsDecimal - a.oddsDecimal,
      );
      const best = sortedPrices[0];
      const worst = sortedPrices[sortedPrices.length - 1];
      const averageOdds = this.round(
        sortedPrices.reduce((sum, price) => sum + price.oddsDecimal, 0) /
          sortedPrices.length,
        4,
      );
      const priceSpreadPct =
        worst.oddsDecimal > 0
          ? this.round(
              (best.oddsDecimal - worst.oddsDecimal) / worst.oddsDecimal,
              4,
            )
          : 0;
      const bestHoldPct = best.holdPct;
      const score = this.scoreCandidate(
        priceSpreadPct,
        bestHoldPct,
        uniqueBookmakers.size,
      );
      const recommendation = this.recommend(
        priceSpreadPct,
        bestHoldPct,
        uniqueBookmakers.size,
      );
      const reasons = this.explainCandidate(
        priceSpreadPct,
        bestHoldPct,
        uniqueBookmakers.size,
        recommendation,
      );

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

  private scoreCandidate(
    priceSpreadPct: number,
    holdPct: number | null,
    bookmakerCount: number,
  ): number {
    const spreadScore = priceSpreadPct * 100;
    const liquidityScore = Math.min(bookmakerCount, 10) * 0.5;
    const holdPenalty = holdPct === null ? 3 : holdPct * 100;

    return this.round(spreadScore + liquidityScore - holdPenalty, 4);
  }

  private recommend(
    priceSpreadPct: number,
    holdPct: number | null,
    bookmakerCount: number,
  ): ScannerRecommendation {
    if (bookmakerCount < 2) return "skip";
    if (priceSpreadPct >= 0.04 && bookmakerCount >= 3)
      return "price_shopping_candidate";
    if (holdPct !== null && holdPct <= 0.04 && bookmakerCount >= 2)
      return "clean_market_candidate";
    return "watch";
  }

  private explainCandidate(
    priceSpreadPct: number,
    holdPct: number | null,
    bookmakerCount: number,
    recommendation: ScannerRecommendation,
  ): string[] {
    const reasons: string[] = [];

    if (recommendation === "price_shopping_candidate") {
      reasons.push(
        "Best price is meaningfully higher than the worst available price.",
      );
    }

    if (recommendation === "clean_market_candidate") {
      reasons.push(
        "Market hold is relatively low compared with typical recreational pricing.",
      );
    }

    if (recommendation === "watch") {
      reasons.push(
        "Candidate is worth monitoring, but no model edge is confirmed yet.",
      );
    }

    reasons.push(`Available across ${bookmakerCount} bookmaker(s).`);
    reasons.push(`Price spread: ${(priceSpreadPct * 100).toFixed(2)}%.`);

    if (holdPct !== null) {
      reasons.push(
        `Best-bookmaker market hold: ${(holdPct * 100).toFixed(2)}%.`,
      );
    } else {
      reasons.push("Market hold could not be calculated for this market.");
    }

    reasons.push(
      "No stake suggested until model probability and EV are connected.",
    );

    return reasons;
  }

  private mapMarketType(marketKey: string): string {
    const map: Record<string, string> = {
      h2h: "moneyline",
      spreads: "spread",
      totals: "total",
      btts: "both_teams_to_score",
      draw_no_bet: "draw_no_bet",
      alternate_spreads: "alternate_spread",
      alternate_totals: "alternate_total",
    };

    return map[marketKey] || marketKey;
  }

  private getApiKey(): string {
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) {
      throw new BadRequestException(
        "THE_ODDS_API_KEY is not configured. Set it before running the API.",
      );
    }
    return apiKey;
  }

  private async request<T = unknown>(
    path: string,
    params: Record<string, string | undefined>,
  ): Promise<{ usage: OddsApiUsage; data: T }> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("apiKey", this.getApiKey());

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url);
    const usage = this.extractUsage(response.headers);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `The Odds API request failed: ${response.status} ${response.statusText} - ${body}`,
      );
    }

    return {
      usage,
      data: (await response.json()) as T,
    };
  }

  private mergeUsage(items: OddsApiUsage[]): OddsApiUsage {
    const filtered = items.filter(Boolean);
    const last = [...filtered]
      .reverse()
      .find(
        (item) => item.requestsRemaining !== null || item.requestsUsed !== null,
      );
    const requestsLast = filtered.reduce(
      (sum, item) => sum + (item.requestsLast ?? 0),
      0,
    );

    return {
      requestsRemaining: last?.requestsRemaining ?? null,
      requestsUsed: last?.requestsUsed ?? null,
      requestsLast: requestsLast > 0 ? requestsLast : null,
    };
  }

  private extractUsage(headers: Headers): OddsApiUsage {
    return {
      requestsRemaining: this.headerNumber(headers, "x-requests-remaining"),
      requestsUsed: this.headerNumber(headers, "x-requests-used"),
      requestsLast: this.headerNumber(headers, "x-requests-last"),
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
    return message.replace(/apiKey=[^&\s]+/g, "apiKey=***").slice(0, 280);
  }

  private round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
