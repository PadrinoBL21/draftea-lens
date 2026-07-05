import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DashboardBacktesting,
  DashboardCollection,
  DashboardModels,
  DashboardOverview,
  DashboardRisks,
} from './dashboard.types';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly apiBaseUrl = 'http://localhost:3000';

  constructor(private readonly http: HttpClient) {}

  getOverview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>(`${this.apiBaseUrl}/dashboard/overview`);
  }

  getBacktesting(limit = 5): Observable<DashboardBacktesting> {
    return this.http.get<DashboardBacktesting>(`${this.apiBaseUrl}/dashboard/backtesting?limit=${limit}`);
  }

  getCollection(limit = 5): Observable<DashboardCollection> {
    return this.http.get<DashboardCollection>(`${this.apiBaseUrl}/dashboard/collection?limit=${limit}`);
  }

  getModels(limit = 5): Observable<DashboardModels> {
    return this.http.get<DashboardModels>(`${this.apiBaseUrl}/dashboard/models?limit=${limit}`);
  }

  getRisks(): Observable<DashboardRisks> {
    return this.http.get<DashboardRisks>(`${this.apiBaseUrl}/dashboard/risks`);
  }
}
