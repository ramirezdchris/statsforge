import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateAnalysisRequestDto } from './dto/create-analysis-request.dto';
import { RejectAnalysisRequestDto } from './dto/reject-analysis-request.dto';
import { RequestsService } from './requests.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.requests.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAnalysisRequestDto) {
    return this.requests.create(user.sub, dto);
  }

  @Roles(Role.ADMIN, Role.ANALYST)
  @Post(':id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requests.approve(user.sub, id);
  }

  @Roles(Role.ADMIN, Role.ANALYST)
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectAnalysisRequestDto,
  ) {
    return this.requests.reject(user.sub, id, dto.reason);
  }
}
