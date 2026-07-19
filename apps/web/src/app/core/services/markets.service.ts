import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiUrl } from '../config/runtime-config';
import { Market } from '../models/football.models';

@Injectable({ providedIn: 'root' })
export class MarketsService {
  constructor(private readonly http: HttpClient) {}

  findAll() {
    return this.http.get<Market[]>(apiUrl('/markets'));
  }
}
