import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  AppUser,
  InviteUserRequest,
  InviteUserResponse,
  TemporaryPasswordResponse,
} from '../models/user.models';

const API_BASE_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  findAll() {
    return this.http.get<AppUser[]>(`${API_BASE_URL}/users`);
  }

  invite(payload: InviteUserRequest) {
    return this.http.post<InviteUserResponse>(`${API_BASE_URL}/users/invite`, payload);
  }

  resetPassword(userId: string) {
    return this.http.post<TemporaryPasswordResponse>(
      `${API_BASE_URL}/users/${userId}/reset-password`,
      {},
    );
  }
}
