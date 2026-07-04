import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ScannerRecommendation = 'price_shopping_candidate' | 'clean_market_candidate' | 'watch' | 'skip';

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
  scanner: 'smart_catalog_scanner_v0_1' | 'auto_scanner_v0_1';
  mode: 'market_intelligence_no_model_ev';
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
    source: 'the-odds-api';
    discoveredAt: string;
    activeSports: number;
    scannedSports: Array<{
      key: string;
      title: string;
      group: string;
      marketsRequested: string;
      eventsReturned: number;
      status: 'ok' | 'degraded' | 'skipped' | 'failed';
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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly http = inject(HttpClient);

  readonly apiBaseUrl = signal('http://localhost:3000');
  readonly bankroll = signal(1000);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<SmartScanResult | null>(null);

  readonly topCandidate = computed(() => this.result()?.candidates?.[0] ?? null);
  readonly scannedSports = computed(() => this.result()?.catalog?.scannedSports ?? []);

  smartScan(): void {
    this.error.set(null);
    this.result.set(null);
    this.loading.set(true);

    this.http.post<SmartScanResult>(`${this.apiBaseUrl()}/scanner/smart-scan`, {
      bankroll: Number(this.bankroll()),
    }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.message ?? error?.message ?? 'No se pudo ejecutar el smart scan.');
        this.loading.set(false);
      },
    });
  }

  recommendationLabel(recommendation: ScannerRecommendation): string {
    const labels: Record<ScannerRecommendation, string> = {
      price_shopping_candidate: 'Mejor precio',
      clean_market_candidate: 'Mercado limpio',
      watch: 'Watch',
      skip: 'Skip',
    };
    return labels[recommendation];
  }

  marketLabel(candidate: AutoScanCandidate): string {
    const point = candidate.point === undefined ? '' : ` ${candidate.point > 0 ? '+' : ''}${candidate.point}`;
    return `${candidate.marketType}${point}`;
  }

  sportStatusClass(status: string): string {
    if (status === 'ok') return 'good';
    if (status === 'degraded') return 'warn';
    return 'bad';
  }

  localDate(value: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  percent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${(value * 100).toFixed(2)}%`;
  }

  money(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
