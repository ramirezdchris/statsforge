import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Market } from '../models/football.models';

const API_BASE_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class MarketsService {
  constructor(private readonly http: HttpClient) {}

  findAll() {
    return this.http.get<Market[]>(`${API_BASE_URL}/markets`);
  }
}
