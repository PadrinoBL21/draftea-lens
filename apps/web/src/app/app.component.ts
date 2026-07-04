import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Decision = 'single_viable' | 'watch' | 'no_bet';

type MoneylineOutcomeInput = {
  label: string;
  oddsDecimal: number;
  modelProbability: number;
};

type MoneylineOutcomeResult = MoneylineOutcomeInput & {
  impliedProbabilityRaw: number;
  impliedProbabilityNoVig: number;
  fairOdds: number | null;
  edgeRaw: number;
  edgeNoVig: number;
  expectedValuePerUnit: number;
  kellyFull: number;
  kellyFractional: number;
  stakeSuggested: number;
  decision: Decision;
  reasons: string[];
};

type MoneylineAnalyzeResult = {
  eventName: string;
  bankroll: number;
  overround: number;
  marketHoldPct: number;
  bestOutcome: MoneylineOutcomeResult | null;
  outcomes: MoneylineOutcomeResult[];
  summary: {
    recommendation: Decision;
    message: string;
  };
};

type MarketSelection = {
  label: string;
  oddsDecimal: number;
  rawLine: string;
};

type ImportedMarket = {
  marketType: string;
  displayName: string;
  selections: MarketSelection[];
};

type ImportedEvent = {
  eventName: string;
  markets: ImportedMarket[];
};

type MarketImportResult = {
  source: string;
  sport: string;
  league: string;
  importedAt: string;
  events: ImportedEvent[];
  warnings: { lineNumber: number; line: string; message: string }[];
  totals: {
    events: number;
    markets: number;
    selections: number;
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
  readonly eventName = signal('Canada vs Morocco');
  readonly bankroll = signal(1000);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly result = signal<MoneylineAnalyzeResult | null>(null);

  readonly marketRawText = signal(`Canada vs Morocco
Moneyline
Canada 2.40
Draw 3.25
Morocco 2.90

Player Props
Hakimi 1+ tiro 1.55
David 1+ tiro a puerta 2.10
Bono más de 3.5 atajadas 1.85`);
  readonly marketSport = signal('soccer');
  readonly marketLeague = signal('world_cup');
  readonly marketImportLoading = signal(false);
  readonly marketImportError = signal<string | null>(null);
  readonly marketImportResult = signal<MarketImportResult | null>(null);

  readonly outcomes = signal<MoneylineOutcomeInput[]>([
    { label: 'Canada', oddsDecimal: 2.4, modelProbability: 0.412 },
    { label: 'Draw', oddsDecimal: 3.25, modelProbability: 0.268 },
    { label: 'Morocco', oddsDecimal: 2.9, modelProbability: 0.32 },
  ]);

  readonly modelTotal = computed(() => {
    return this.outcomes().reduce((sum, outcome) => sum + Number(outcome.modelProbability || 0), 0);
  });

  updateOutcome(index: number, key: keyof MoneylineOutcomeInput, value: string): void {
    const next = [...this.outcomes()];
    const current = { ...next[index] };

    if (key === 'label') {
      current.label = value;
    } else {
      current[key] = Number(value) as never;
    }

    next[index] = current;
    this.outcomes.set(next);
  }

  addOutcome(): void {
    this.outcomes.set([...this.outcomes(), { label: `Pick ${this.outcomes().length + 1}`, oddsDecimal: 2, modelProbability: 0.25 }]);
  }

  removeOutcome(index: number): void {
    if (this.outcomes().length <= 2) return;
    this.outcomes.set(this.outcomes().filter((_, i) => i !== index));
  }

  loadNoBetSample(): void {
    this.eventName.set('Canada vs Morocco');
    this.bankroll.set(1000);
    this.outcomes.set([
      { label: 'Canada', oddsDecimal: 2.4, modelProbability: 0.412 },
      { label: 'Draw', oddsDecimal: 3.25, modelProbability: 0.268 },
      { label: 'Morocco', oddsDecimal: 2.9, modelProbability: 0.32 },
    ]);
    this.result.set(null);
  }

  loadValueSample(): void {
    this.eventName.set('Test Value Match');
    this.bankroll.set(1000);
    this.outcomes.set([
      { label: 'Team A', oddsDecimal: 2.6, modelProbability: 0.45 },
      { label: 'Draw', oddsDecimal: 3.2, modelProbability: 0.27 },
      { label: 'Team B', oddsDecimal: 2.8, modelProbability: 0.28 },
    ]);
    this.result.set(null);
  }

  analyze(): void {
    this.errorMessage.set(null);
    this.result.set(null);
    this.isLoading.set(true);

    const payload = {
      eventName: this.eventName(),
      bankroll: Number(this.bankroll()),
      outcomes: this.outcomes().map((outcome) => ({
        label: outcome.label,
        oddsDecimal: Number(outcome.oddsDecimal),
        modelProbability: Number(outcome.modelProbability),
      })),
    };

    this.http.post<MoneylineAnalyzeResult>(`${this.apiBaseUrl()}/moneyline/analyze`, payload).subscribe({
      next: (result) => {
        this.result.set(result);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message ?? error?.message ?? 'No se pudo analizar el partido.');
        this.isLoading.set(false);
      },
    });
  }

  importMarkets(): void {
    this.marketImportError.set(null);
    this.marketImportResult.set(null);
    this.marketImportLoading.set(true);

    const payload = {
      rawText: this.marketRawText(),
      sport: this.marketSport(),
      league: this.marketLeague(),
      source: 'draftea_visible',
    };

    this.http.post<MarketImportResult>(`${this.apiBaseUrl()}/markets/import-text`, payload).subscribe({
      next: (result) => {
        this.marketImportResult.set(result);
        this.marketImportLoading.set(false);
      },
      error: (error) => {
        this.marketImportError.set(error?.error?.message ?? error?.message ?? 'No se pudieron importar los mercados.');
        this.marketImportLoading.set(false);
      },
    });
  }

  applyMoneylineFromImport(event: ImportedEvent, market: ImportedMarket): void {
    this.eventName.set(event.eventName);
    const probability = market.selections.length > 0 ? 1 / market.selections.length : 0.33;
    this.outcomes.set(
      market.selections.map((selection) => ({
        label: selection.label,
        oddsDecimal: selection.oddsDecimal,
        modelProbability: Number(probability.toFixed(4)),
      })),
    );
    this.result.set(null);
  }

  decisionLabel(decision: Decision): string {
    const labels: Record<Decision, string> = {
      single_viable: 'Single viable',
      watch: 'Watch',
      no_bet: 'No bet',
    };
    return labels[decision];
  }

  percent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  signedPercent(value: number): string {
    const pct = value * 100;
    const prefix = pct > 0 ? '+' : '';
    return `${prefix}${pct.toFixed(2)}%`;
  }

  money(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
