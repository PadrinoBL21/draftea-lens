import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { DashboardApiService } from './dashboard-api.service';
import {
  DashboardBacktesting,
  DashboardCollection,
  DashboardModels,
  DashboardOverview,
  DashboardRisks,
} from './dashboard.types';

interface DashboardLoadState {
  overview: DashboardOverview | null;
  backtesting: DashboardBacktesting | null;
  collection: DashboardCollection | null;
  models: DashboardModels | null;
  risks: DashboardRisks | null;
}

@Component({
  selector: 'app-dashboard-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="dl-dashboard">
      <div class="dl-dashboard__hero">
        <div>
          <p class="dl-eyebrow">Draftea Lens Command Center</p>
          <h1>Dashboard del sistema</h1>
          <p class="dl-muted">
            Estado de recolección, backtesting, modelos, riesgos y readiness del dataset.
          </p>
        </div>

        <div class="dl-hero-actions">
          <button type="button" (click)="refreshAll()" [disabled]="loading()">
            {{ loading() ? 'Actualizando...' : 'Actualizar dashboard' }}
          </button>
          <span class="dl-pill" [class.dl-pill--warn]="readiness() !== 'ready_for_neural_training'">
            {{ readinessLabel() }}
          </span>
        </div>
      </div>

      <div *ngIf="errorMessage()" class="dl-alert dl-alert--bad">
        {{ errorMessage() }}
      </div>

      <div class="dl-grid dl-grid--cards">
        <article class="dl-card">
          <p class="dl-card__label">Paper picks</p>
          <strong>{{ collection()?.paperPickCount ?? '—' }}</strong>
          <span>Total acumulado local</span>
        </article>

        <article class="dl-card">
          <p class="dl-card__label">Odds observations</p>
          <strong>{{ collection()?.oddsLineObservationCount ?? '—' }}</strong>
          <span>Historial de líneas guardado</span>
        </article>

        <article class="dl-card">
          <p class="dl-card__label">Feature vectors</p>
          <strong>{{ collection()?.featureVectorCount ?? '—' }}</strong>
          <span>Dataset listo para backtesting/ML</span>
        </article>

        <article class="dl-card">
          <p class="dl-card__label">Blockers</p>
          <strong>{{ risks()?.blockers?.length ?? '—' }}</strong>
          <span>Problemas que frenan ML real</span>
        </article>
      </div>

      <div class="dl-grid dl-grid--two">
        <article class="dl-panel">
          <div class="dl-panel__header">
            <h2>Modelo activo</h2>
            <span class="dl-pill dl-pill--good">Champion</span>
          </div>
          <dl class="dl-kv">
            <div>
              <dt>Champion</dt>
              <dd>{{ models()?.champion?.modelVersion ?? '—' }}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{{ models()?.champion?.modelType ?? '—' }}</dd>
            </div>
            <div>
              <dt>Challenger</dt>
              <dd>{{ models()?.latestMlModel?.modelVersion ?? '—' }}</dd>
            </div>
            <div>
              <dt>ML status</dt>
              <dd>{{ models()?.latestMlModel?.status ?? '—' }}</dd>
            </div>
            <div>
              <dt>Promotable</dt>
              <dd>{{ models()?.latestGovernanceEvaluation?.promotable === true ? 'Sí' : 'No' }}</dd>
            </div>
          </dl>
        </article>

        <article class="dl-panel">
          <div class="dl-panel__header">
            <h2>Último backtest</h2>
            <span class="dl-pill">Paper only</span>
          </div>
          <dl class="dl-kv">
            <div>
              <dt>Run</dt>
              <dd>{{ backtesting()?.latestBacktest?.runId ?? '—' }}</dd>
            </div>
            <div>
              <dt>Eligible rows</dt>
              <dd>{{ backtesting()?.latestBacktest?.eligibleRows ?? '—' }}</dd>
            </div>
            <div>
              <dt>ROI</dt>
              <dd>{{ formatPct(backtesting()?.latestBacktest?.roiPct) }}</dd>
            </div>
            <div>
              <dt>P/L</dt>
              <dd>{{ backtesting()?.latestBacktest?.profitLoss ?? '—' }}</dd>
            </div>
            <div>
              <dt>CLV promedio</dt>
              <dd>{{ backtesting()?.latestBacktest?.averageClosingLineValue ?? '—' }}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div class="dl-grid dl-grid--two">
        <article class="dl-panel">
          <div class="dl-panel__header">
            <h2>Recolección</h2>
            <span class="dl-pill" [class.dl-pill--warn]="collection()?.latestCollectorRun?.status !== 'success'">
              {{ collection()?.latestCollectorRun?.status ?? 'sin datos' }}
            </span>
          </div>
          <dl class="dl-kv">
            <div>
              <dt>Collector run</dt>
              <dd>{{ collection()?.latestCollectorRun?.runId ?? '—' }}</dd>
            </div>
            <div>
              <dt>Scheduler run</dt>
              <dd>{{ collection()?.latestSchedulerRun?.runId ?? '—' }}</dd>
            </div>
            <div>
              <dt>Scheduler status</dt>
              <dd>{{ collection()?.latestSchedulerRun?.status ?? '—' }}</dd>
            </div>
            <div>
              <dt>Readiness</dt>
              <dd>{{ collection()?.latestSchedulerRun?.dataQualityReadiness ?? risks()?.readiness ?? '—' }}</dd>
            </div>
          </dl>
        </article>

        <article class="dl-panel dl-panel--risk">
          <div class="dl-panel__header">
            <h2>Riesgos actuales</h2>
            <span class="dl-pill dl-pill--bad">{{ risks()?.readiness ?? 'sin auditoría' }}</span>
          </div>
          <ul class="dl-list" *ngIf="risks()?.blockers?.length; else noBlockers">
            <li *ngFor="let blocker of risks()?.blockers">{{ blocker }}</li>
          </ul>
          <ng-template #noBlockers>
            <p class="dl-muted">Sin blockers activos.</p>
          </ng-template>
        </article>
      </div>

      <article class="dl-panel">
        <div class="dl-panel__header">
          <h2>Recomendaciones operativas</h2>
          <span class="dl-pill">Next actions</span>
        </div>
        <ul class="dl-list dl-list--columns">
          <li *ngFor="let recommendation of risks()?.recommendations ?? []">
            {{ recommendation }}
          </li>
        </ul>
      </article>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .dl-dashboard {
        display: grid;
        gap: 1rem;
        color: #e7ecf5;
        padding: 1rem;
      }
      .dl-dashboard__hero,
      .dl-card,
      .dl-panel {
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(17, 24, 39, 0.9));
        border-radius: 1.25rem;
        box-shadow: 0 18px 60px rgba(2, 6, 23, 0.35);
      }
      .dl-dashboard__hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem;
      }
      .dl-dashboard h1,
      .dl-dashboard h2,
      .dl-dashboard p { margin: 0; }
      .dl-dashboard h1 { font-size: clamp(1.6rem, 2.5vw, 2.5rem); }
      .dl-dashboard h2 { font-size: 1.05rem; }
      .dl-eyebrow {
        color: #38bdf8;
        font-size: 0.78rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        margin-bottom: 0.35rem !important;
      }
      .dl-muted { color: #94a3b8; }
      .dl-hero-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
      button {
        border: 0;
        border-radius: 999px;
        padding: 0.75rem 1rem;
        background: #38bdf8;
        color: #082f49;
        font-weight: 700;
        cursor: pointer;
      }
      button:disabled { opacity: 0.65; cursor: wait; }
      .dl-grid { display: grid; gap: 1rem; }
      .dl-grid--cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .dl-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .dl-card, .dl-panel { padding: 1rem; }
      .dl-card strong { display: block; font-size: 2rem; margin: 0.2rem 0; }
      .dl-card span, .dl-card__label { color: #94a3b8; font-size: 0.85rem; }
      .dl-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
      .dl-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.14);
        color: #cbd5e1;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.35rem 0.65rem;
      }
      .dl-pill--good { background: rgba(34, 197, 94, 0.18); color: #86efac; }
      .dl-pill--warn { background: rgba(245, 158, 11, 0.18); color: #fcd34d; }
      .dl-pill--bad { background: rgba(239, 68, 68, 0.18); color: #fca5a5; }
      .dl-alert { padding: 1rem; border-radius: 1rem; }
      .dl-alert--bad { background: rgba(239, 68, 68, 0.18); color: #fecaca; }
      .dl-kv { display: grid; gap: 0.75rem; margin: 0; }
      .dl-kv div { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid rgba(148, 163, 184, 0.12); padding-bottom: 0.65rem; }
      .dl-kv dt { color: #94a3b8; }
      .dl-kv dd { margin: 0; text-align: right; max-width: 65%; overflow-wrap: anywhere; }
      .dl-list { margin: 0; padding-left: 1.1rem; color: #cbd5e1; }
      .dl-list li { margin-bottom: 0.55rem; }
      .dl-list--columns { columns: 2; }
      @media (max-width: 980px) {
        .dl-grid--cards, .dl-grid--two { grid-template-columns: 1fr; }
        .dl-dashboard__hero { align-items: flex-start; flex-direction: column; }
        .dl-list--columns { columns: 1; }
      }
    `,
  ],
})
export class DashboardPanelComponent implements OnInit {
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly state = signal<DashboardLoadState>({
    overview: null,
    backtesting: null,
    collection: null,
    models: null,
    risks: null,
  });

  readonly overview = computed(() => this.state().overview);
  readonly backtesting = computed(() => this.state().backtesting);
  readonly collection = computed(() => this.state().collection);
  readonly models = computed(() => this.state().models);
  readonly risks = computed(() => this.state().risks);
  readonly readiness = computed(() => this.risks()?.readiness ?? this.overview()?.readiness ?? 'unknown');
  readonly readinessLabel = computed(() => this.readiness().replaceAll('_', ' '));

  constructor(private readonly dashboardApi: DashboardApiService) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      overview: this.dashboardApi.getOverview(),
      backtesting: this.dashboardApi.getBacktesting(),
      collection: this.dashboardApi.getCollection(),
      models: this.dashboardApi.getModels(),
      risks: this.dashboardApi.getRisks(),
    }).subscribe({
      next: (state) => {
        this.state.set(state);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(this.toErrorMessage(error));
      },
    });
  }

  formatPct(value: unknown): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '—';
    }

    return `${value.toFixed(2)}%`;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudo cargar el dashboard. Verifica que la API esté viva en http://localhost:3000.';
  }
}
