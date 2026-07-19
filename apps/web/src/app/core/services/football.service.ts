import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiUrl } from '../config/runtime-config';
import {
  ApiFootballWrapper,
  FootballFixture,
  FootballLeague,
  FootballTeam,
} from '../models/football.models';

@Injectable({ providedIn: 'root' })
export class FootballService {
  constructor(private readonly http: HttpClient) {}

  leagues(search: string, season: number) {
    const params = new HttpParams().set('search', search).set('season', season);
    return this.http.get<ApiFootballWrapper<FootballLeague[]>>(apiUrl('/football/leagues'), {
      params,
    });
  }

  teams(leagueId: number, season: number) {
    const params = new HttpParams().set('league', leagueId).set('season', season);
    return this.http.get<ApiFootballWrapper<FootballTeam[]>>(apiUrl('/football/teams'), {
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
      apiUrl('/football/fixtures'),
      { params },
    );
  }
}
