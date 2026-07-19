import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FootballService } from './football.service';

@UseGuards(JwtAuthGuard)
@Controller('football')
export class FootballController {
  constructor(private readonly football: FootballService) {}

  @Get('leagues')
  leagues(
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('season') season?: string,
    @Query('current') current?: string,
  ) {
    return this.football.leagues({ search, country, season: search ? undefined : season, current });
  }

  @Get('teams')
  teams(@Query('league') league?: string, @Query('season') season?: string) {
    return this.football.teams({ league, season });
  }

  @Get('fixtures')
  fixtures(
    @Query('league') league?: string,
    @Query('season') season?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('next') next?: string,
  ) {
    return this.football.fixtures({ league, season, date, from, to, next });
  }
}
