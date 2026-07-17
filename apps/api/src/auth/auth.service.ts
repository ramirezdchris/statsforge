import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, request: Request): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit(user.id, 'LOGIN', { ipAddress: request.ip });

    return this.issueTokenPair(user, request);
  }

  async refresh(refreshToken: string, request: Request): Promise<TokenPair> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.delete({ where: { id: session.id } });
    return this.issueTokenPair(session.user, request);
  }

  async logout(refreshToken: string) {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
    });

    if (session) {
      await this.prisma.session.delete({ where: { id: session.id } });
      await this.audit(session.userId, 'LOGOUT');
    }

    return { success: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    request: Request,
  ): Promise<TokenPair> {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const isValidPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    await this.prisma.session.deleteMany({ where: { userId } });
    await this.audit(userId, 'CHANGE_PASSWORD');

    return this.issueTokenPair(updatedUser, request);
  }

  private async issueTokenPair(user: User, request: Request): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        expiresAt: new Date(Date.now() + this.durationToMs(refreshTtl)),
      },
    });

    const scope = user.mustChangePassword ? 'password-change-only' : 'full-access';
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      scope,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private durationToMs(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error(`Invalid duration: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit];
  }

  private async audit(userId: string, action: string, metadata?: unknown) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  }
}
