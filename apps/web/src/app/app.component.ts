import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

type ScannerRecommendation =
  | "price_shopping_candidate"
  | "clean_market_candidate"
  | "watch"
  | "skip";

type AutoScanCandidate = {
  eventId: string;
  eventName: string;
  commenceTime: string;
  sportKey: string;
  marketKey: string;
  marketType: string;
  selection: string;
  point?: number;
  bestOddsDecimal: number;
  bestBookmaker: string;
  worstOddsDecimal: number;
  averageOddsDecimal: number;
  impliedProbabilityBest: number;
  consensusImpliedProbability: number;
  bookmakerCount: number;
  priceSpreadPct: number;
  bestBookmakerHoldPct: number | null;
  score: number;
  recommendation: ScannerRecommendation;
  stakeSuggested: number;
  reasons: string[];
};

type SmartScanResult = {
  scanner: "smart_catalog_scanner_v0_1" | "auto_scanner_v0_1";
  mode: "market_intelligence_no_model_ev";
  scannedAt: string;
  query: {
    bankroll: number;
    sports?: string[];
    regions: string;
    markets: string;
    oddsFormat: string;
    maxResults: number;
    minBookmakers: number;
    sportLimit?: number;
    hoursAhead?: number;
  };
  usage: {
    requestsRemaining: number | null;
    requestsUsed: number | null;
    requestsLast: number | null;
  };
  totals: {
    rawEvents: number;
    candidates: number;
    returned: number;
    scannedSports?: number;
    activeSports?: number;
  };
  catalog?: {
    source: "the-odds-api";
    discoveredAt: string;
    activeSports: number;
    scannedSports: Array<{
      key: string;
      title: string;
      group: string;
      marketsRequested: string;
      eventsReturned: number;
      status: "ok" | "degraded" | "skipped" | "failed";
      note?: string;
    }>;
  };
  warnings: string[];
  candidates: AutoScanCandidate[];
  summary: {
    recommendation: string;
    message: string;
  };
};

type CandidateBucket = {
  label: string;
  subtitle: string;
  accent: "worldcup" | "moneyline" | "totals" | "spread" | "clean" | "price";
  candidates: AutoScanCandidate[];
};

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  private readonly http = inject(HttpClient);

  readonly apiBaseUrl = signal("http://localhost:3000");
  readonly bankroll = signal(1000);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<SmartScanResult | null>(null);

  readonly candidates = computed(() => this.result()?.candidates ?? []);
  readonly topCandidate = computed(() => this.candidates()[0] ?? null);
  readonly scannedSports = computed(
    () => this.result()?.catalog?.scannedSports ?? [],
  );
  readonly worldCupSports = computed(() =>
    this.scannedSports().filter((sport) => sport.key.includes("world_cup")),
  );

  readonly worldCupCandidates = computed(() =>
    this.candidates()
      .filter((candidate) => candidate.sportKey.includes("world_cup"))
      .slice(0, 8),
  );

  readonly moneylineCandidates = computed(() =>
    this.candidates()
      .filter((candidate) => candidate.marketType === "moneyline")
      .slice(0, 8),
  );

  readonly totalsCandidates = computed(() =>
    this.candidates()
      .filter((candidate) => candidate.marketType === "total")
      .slice(0, 8),
  );

  readonly spreadCandidates = computed(() =>
    this.candidates()
      .filter((candidate) => candidate.marketType === "spread")
      .slice(0, 8),
  );

  readonly cleanMarketCandidates = computed(() =>
    this.candidates()
      .filter(
        (candidate) => candidate.recommendation === "clean_market_candidate",
      )
      .slice(0, 8),
  );

  readonly priceShoppingCandidates = computed(() =>
    this.candidates()
      .filter(
        (candidate) => candidate.recommendation === "price_shopping_candidate",
      )
      .slice(0, 8),
  );
  private bucket(
    label: string,
    subtitle: string,
    accent: CandidateBucket["accent"],
    candidates: AutoScanCandidate[],
  ): CandidateBucket {
    return {
      label,
      subtitle,
      accent,
      candidates,
    };
  }
  private candidatesByMarket(marketType: string): AutoScanCandidate[] {
    return this.candidates().filter((candidate) => {
      return (
        candidate.marketType === marketType ||
        candidate.marketKey === marketType
      );
    });
  }

  private candidatesByRecommendation(
    recommendation: string,
  ): AutoScanCandidate[] {
    return this.candidates().filter((candidate) => {
      return candidate.recommendation === recommendation;
    });
  }
  readonly buckets = computed<CandidateBucket[]>(() => [
    this.bucket(
      "Top Mundial",
      "Candidatos detectados en FIFA World Cup.",
      "worldcup",
      this.worldCupCandidates().slice(0, 8),
    ),
    this.bucket(
      "Top Moneyline",
      "Moneyline / ganador del partido.",
      "moneyline",
      this.candidatesByMarket("moneyline").slice(0, 8),
    ),
    this.bucket(
      "Top Totales",
      "Over / Under con diferencia de precio.",
      "totals",
      this.candidatesByMarket("total").slice(0, 8),
    ),
    this.bucket(
      "Top Spreads",
      "Handicap / spread con mejor precio relativo.",
      "spread",
      this.candidatesByMarket("spread").slice(0, 8),
    ),
    this.bucket(
      "Mercados limpios",
      "Mercados con hold relativamente bajo.",
      "clean",
      this.candidatesByRecommendation("clean_market_candidate").slice(0, 8),
    ),
    this.bucket(
      "Price Shopping",
      "Diferencias grandes entre casas.",
      "price",
      this.candidatesByRecommendation("price_shopping_candidate").slice(0, 8),
    ),
  ]);

  smartScan(): void {
    this.error.set(null);
    this.result.set(null);
    this.loading.set(true);

    this.http
      .post<SmartScanResult>(`${this.apiBaseUrl()}/scanner/smart-scan`, {
        bankroll: Number(this.bankroll()),
      })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(
            error?.error?.message ??
              error?.message ??
              "No se pudo ejecutar el smart scan.",
          );
          this.loading.set(false);
        },
      });
  }

  recommendationLabel(recommendation: ScannerRecommendation): string {
    const labels: Record<ScannerRecommendation, string> = {
      price_shopping_candidate: "Mejor precio",
      clean_market_candidate: "Mercado limpio",
      watch: "Watch",
      skip: "Skip",
    };
    return labels[recommendation] ?? recommendation;
  }

  marketLabel(candidate: AutoScanCandidate): string {
    const point =
      candidate.point === undefined
        ? ""
        : ` ${candidate.point > 0 ? "+" : ""}${candidate.point}`;

    if (candidate.marketType === "moneyline") return "Moneyline";
    if (candidate.marketType === "spread") return `Spread${point}`;
    if (candidate.marketType === "total")
      return `${candidate.selection}${point}`;
    if (candidate.marketKey === "outrights") return "Futuro";

    return `${candidate.marketType}${point}`;
  }

  sportLabel(key: string): string {
    if (key === "soccer_fifa_world_cup") return "Mundial FIFA";
    if (key === "soccer_fifa_world_cup_winner") return "Mundial Winner";
    if (key === "baseball_mlb") return "MLB";
    if (key === "basketball_nba") return "NBA";
    if (key === "americanfootball_nfl") return "NFL";
    if (key === "soccer_mexico_ligamx") return "Liga MX";

    return key
      .replace(/^soccer_/, "")
      .replace(/^americanfootball_/, "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  sportStatusClass(status: string): string {
    if (status === "ok") return "good";
    if (status === "degraded") return "warn";
    return "bad";
  }

  bucketClass(bucket: CandidateBucket): string {
    return `bucket bucket-${bucket.accent}`;
  }

  localDate(value: string): string {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  percent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value))
      return "—";
    return `${(value * 100).toFixed(2)}%`;
  }

  money(value: number): string {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(value);
  }
}
