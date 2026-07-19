import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  ApiFootballWrapper,
  FootballFixture,
  FootballLeague,
  FootballTeam,
} from '../models/football.models';

const API_BASE_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class FootballService {
  constructor(private readonly http: HttpClient) {}

  leagues(search: string, season: number) {
    const params = new HttpParams().set('search', search).set('season', season);
    return this.http.get<ApiFootballWrapper<FootballLeague[]>>(`${API_BASE_URL}/football/leagues`, {
      params,
    });
  }

  teams(leagueId: number, season: number) {
    const params = new HttpParams().set('league', leagueId).set('season', season);
    return this.http.get<ApiFootballWrapper<FootballTeam[]>>(`${API_BASE_URL}/football/teams`, {
      params,
    });
  }

  fixtures(leagueId: number, season: number, from: string, to: string) {
    const params = new HttpParams()
      .set('league', leagueId)
      .set('season', season)
      .set('from', from)
      .set('to', to);
    return this.http.get<ApiFootballWrapper<FootballFixture[]>>(
      `${API_BASE_URL}/football/fixtures`,
      { params },
    );
  }
}
