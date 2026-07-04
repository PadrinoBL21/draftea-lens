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
  fairOdds: number;
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
