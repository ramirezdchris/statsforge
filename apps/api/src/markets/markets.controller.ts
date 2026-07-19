import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MarketsService } from './markets.service';

@UseGuards(JwtAuthGuard)
@Controller('markets')
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  findAll() {
    return this.markets.findAll();
  }
}
