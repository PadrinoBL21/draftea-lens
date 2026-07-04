import { Injectable } from '@nestjs/common';
import { normalizeTheOddsApiEvents, TheOddsApiEvent } from '@draftea-lens/core';
import { TheOddsApiEventOddsQueryDto, TheOddsApiOddsQueryDto, TheOddsApiSportsQueryDto } from './the-odds-api.dto';

const BASE_URL = 'https://api.the-odds-api.com/v4';

type UsageHeaders = {
  requestsRemaining: string | null;
  requestsUsed: string | null;
  requestsLast: string | null;
};

@Injectable()
export class TheOddsApiService {
  async getSports(query: TheOddsApiSportsQueryDto) {
    return this.request('/sports', {
      all: query.all,
    });
  }

  async getOdds(query: TheOddsApiOddsQueryDto) {
    const oddsFormat = query.oddsFormat ?? 'decimal';
    const response = await this.request<TheOddsApiEvent[]>(`/sports/${query.sport}/odds`, {
      regions: query.regions ?? 'us,eu',
      markets: query.markets ?? 'h2h,spreads,totals',
      bookmakers: query.bookmakers,
      oddsFormat,
      dateFormat: 'iso',
      commenceTimeFrom: query.commenceTimeFrom,
      commenceTimeTo: query.commenceTimeTo,
      eventIds: query.eventIds,
      includeLinks: 'true',
      includeSids: 'true',
    });

    return {
      provider: 'the-odds-api',
      source: 'external_api',
      query: {
        sport: query.sport,
        regions: query.regions ?? 'us,eu',
        markets: query.markets ?? 'h2h,spreads,totals',
        bookmakers: query.bookmakers ?? null,
        oddsFormat,
      },
      usage: response.usage,
      normalized: normalizeTheOddsApiEvents(response.data, oddsFormat),
      rawEvents: response.data,
    };
  }

  async getEventOdds(query: TheOddsApiEventOddsQueryDto) {
    const oddsFormat = query.oddsFormat ?? 'decimal';
    const response = await this.request<TheOddsApiEvent>(`/sports/${query.sport}/events/${query.eventId}/odds`, {
      regions: query.regions ?? 'us,eu',
      markets: query.markets ?? 'h2h,spreads,totals,btts,draw_no_bet,alternate_spreads,alternate_totals',
      bookmakers: query.bookmakers,
      oddsFormat,
      dateFormat: 'iso',
      includeLinks: 'true',
      includeSids: 'true',
    });

    return {
      provider: 'the-odds-api',
      source: 'external_api',
      query: {
        sport: query.sport,
        eventId: query.eventId,
        regions: query.regions ?? 'us,eu',
        markets: query.markets ?? 'h2h,spreads,totals,btts,draw_no_bet,alternate_spreads,alternate_totals',
        bookmakers: query.bookmakers ?? null,
        oddsFormat,
      },
      usage: response.usage,
      normalized: normalizeTheOddsApiEvents([response.data], oddsFormat),
      rawEvent: response.data,
    };
  }

  private async request<T = unknown>(path: string, params: Record<string, string | undefined>) {
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing THE_ODDS_API_KEY. Add it to your .env or current PowerShell session.');
    }

    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('apiKey', apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url);
    const usage: UsageHeaders = {
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
      requestsLast: response.headers.get('x-requests-last'),
    };

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`The Odds API request failed: ${response.status} ${response.statusText} - ${body}`);
    }

    return {
      usage,
      data: (await response.json()) as T,
    };
  }
}
