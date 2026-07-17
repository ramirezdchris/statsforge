import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AuthService, TokenPair } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request): Promise<TokenPair> {
    return this.authService.login(dto, request);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken, request);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<TokenPair> {
    return this.authService.changePassword(user.sub, dto, request);
  }
}
