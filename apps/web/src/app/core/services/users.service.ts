import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { apiUrl } from '../config/runtime-config';
import {
  AppUser,
  InviteUserRequest,
  InviteUserResponse,
  TemporaryPasswordResponse,
} from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private readonly http: HttpClient) {}

  findAll() {
    return this.http.get<AppUser[]>(apiUrl('/users'));
  }

  invite(payload: InviteUserRequest) {
    return this.http.post<InviteUserResponse>(apiUrl('/users/invite'), payload);
  }

  resetPassword(userId: string) {
    return this.http.post<TemporaryPasswordResponse>(
      apiUrl(`/users/${userId}/reset-password`),
      {},
    );
  }
}
