import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiUrl } from '../config/runtime-config';
import { AnalysisRequest, BasketItem } from '../models/football.models';

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
    return this.http.get<AnalysisRequest[]>(apiUrl('/requests'));
  }

  create(payload: CreateAnalysisRequestPayload) {
    return this.http.post<AnalysisRequest>(apiUrl('/requests'), payload);
  }

  approve(id: string) {
    return this.http.post<AnalysisRequest>(apiUrl(`/requests/${id}/approve`), {});
  }

  reject(id: string, reason?: string) {
    return this.http.post<AnalysisRequest>(apiUrl(`/requests/${id}/reject`), { reason });
  }
}
