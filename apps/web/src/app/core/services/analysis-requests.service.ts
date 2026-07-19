import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AnalysisRequest, BasketItem } from '../models/football.models';

const API_BASE_URL = 'http://localhost:3000';

export interface CreateAnalysisRequestPayload {
  defaultMarkets: string[];
  historyDepth: number;
  includeExcel: boolean;
  deliveryChannel: 'APP' | 'TELEGRAM' | 'BOTH';
  message?: string;
  items: BasketItem[];
}

@Injectable({ providedIn: 'root' })
export class AnalysisRequestsService {
  constructor(private readonly http: HttpClient) {}

  findAll() {
    return this.http.get<AnalysisRequest[]>(`${API_BASE_URL}/requests`);
  }

  create(payload: CreateAnalysisRequestPayload) {
    return this.http.post<AnalysisRequest>(`${API_BASE_URL}/requests`, payload);
  }

  approve(id: string) {
    return this.http.post<AnalysisRequest>(`${API_BASE_URL}/requests/${id}/approve`, {});
  }

  reject(id: string, reason?: string) {
    return this.http.post<AnalysisRequest>(`${API_BASE_URL}/requests/${id}/reject`, { reason });
  }
}
