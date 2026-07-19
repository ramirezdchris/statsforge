import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RequestStatus, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { FootballService } from '../football/football.service';
import { PrismaService } from '../prisma/prisma.service';
import { BasketItemDto, CreateAnalysisRequestDto } from './dto/create-analysis-request.dto';

type PlayedFixture = {
  fixture?: { id?: number; date?: string };
  league?: { id?: number; name?: string };
  teams?: { home?: { id?: number; name?: string }; away?: { id?: number; name?: string } };
  goals?: { home?: number | null; away?: number | null };
  score?: { halftime?: { home?: number | null; away?: number | null } };
};

type TeamSetPieces = {
  corners: number;
  cornersThreshold80: number;
  cornersPctOver80: number;
  lastCorners: number | null;
  shots: number;
  shotsThreshold80: number;
  shotsPctOver80: number;
  lastShots: number | null;
  shotsOnTarget: number;
  shotsOnTargetThreshold80: number;
  shotsOnTargetPctOver80: number;
  lastShotsOnTarget: number | null;
  yellowCards: number;
  yellowCardsThreshold80: number;
  yellowCardsPctOver80: number;
  lastYellowCards: number | null;
  redCards: number;
  lastRedCards: number | null;
  sampleSize: number;
  matchRows: unknown[];
};

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly football: FootballService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    const canReview = user.role === Role.ADMIN || user.role === Role.ANALYST;

    const requests = await this.prisma.analysisRequest.findMany({
      where: canReview ? {} : { requesterId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, email: true, name: true, role: true } },
        reviewer: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    return requests.map((request) => this.serializeRequest(request));
  }

  async create(requesterId: string, dto: CreateAnalysisRequestDto) {
    const validMarkets = await this.validMarketKeys();
    const unknownMarkets = [
      ...dto.defaultMarkets,
      ...dto.items.flatMap((item) => item.marketsOverride ?? []),
    ].filter((market) => !validMarkets.has(market));

    if (unknownMarkets.length) {
      throw new BadRequestException(`Unknown markets: ${[...new Set(unknownMarkets)].join(', ')}`);
    }

    const request = await this.prisma.analysisRequest.create({
      data: {
        requesterId,
        basketJson: JSON.stringify(dto.items),
        defaultMarkets: JSON.stringify(dto.defaultMarkets),
        historyDepth: dto.historyDepth,
        includeExcel: dto.includeExcel ?? false,
        deliveryChannel: dto.deliveryChannel,
        message: dto.message,
        estimatedCalls: this.estimateCalls(dto),
      },
      include: {
        requester: { select: { id: true, email: true, name: true, role: true } },
        reviewer: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    await this.audit(requesterId, 'CREATE_ANALYSIS_REQUEST', { requestId: request.id });
    return this.serializeRequest(request);
  }

  async approve(reviewerId: string, id: string) {
    const request = await this.prisma.analysisRequest.findUnique({ where: { id } });

    if (!request) {
      throw new NotFoundException('Analysis request not found');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const basket = JSON.parse(request.basketJson) as BasketItemDto[];
    const defaultMarkets = JSON.parse(request.defaultMarkets) as string[];
    const result = await this.generateAnalysis(basket, defaultMarkets, request.historyDepth);

    const updatedRequest = await this.prisma.analysisRequest.update({
      where: { id },
      data: {
        reviewerId,
        status: RequestStatus.COMPLETED,
        resultJson: JSON.stringify(result),
        actualCalls: 0,
        reviewedAt: new Date(),
        completedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, email: true, name: true, role: true } },
        reviewer: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    await this.audit(reviewerId, 'APPROVE_ANALYSIS_REQUEST', { requestId: id });
    return this.serializeRequest(updatedRequest);
  }

  async reject(reviewerId: string, id: string, reason?: string) {
    const request = await this.prisma.analysisRequest.findUnique({ where: { id } });

    if (!request) {
      throw new NotFoundException('Analysis request not found');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updatedRequest = await this.prisma.analysisRequest.update({
      where: { id },
      data: {
        reviewerId,
        status: RequestStatus.REJECTED,
        rejectionReason: reason,
        reviewedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, email: true, name: true, role: true } },
        reviewer: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    await this.audit(reviewerId, 'REJECT_ANALYSIS_REQUEST', { requestId: id, reason });
    return this.serializeRequest(updatedRequest);
  }

  private async generateAnalysis(
    basket: BasketItemDto[],
    defaultMarkets: string[],
    defaultHistoryDepth: number,
  ) {
    const matches: unknown[] = [];

    for (const item of basket) {
      const markets = item.marketsOverride?.length ? item.marketsOverride : defaultMarkets;
      const historyDepth = item.historyDepthOverride ?? defaultHistoryDepth;
      const seasons = [item.season, item.season - 1, item.season - 2];
      const [homeFixtures, awayFixtures, h2hResponse] = await Promise.all([
        this.teamFixtures(item.homeTeamId, seasons),
        this.teamFixtures(item.awayTeamId, seasons),
        this.football.headToHead(item.homeTeamId, item.awayTeamId),
      ]);

      const homeRecent = homeFixtures.slice(-historyDepth);
      const awayRecent = awayFixtures.slice(-historyDepth);
      const h2h = (h2hResponse.response as PlayedFixture[]).filter((fixture) =>
        this.isPlayed(fixture),
      );
      const needsStats = markets.some((market) =>
        ['CORNERS', 'TOTAL_SHOTS', 'SHOTS_ON_TARGET', 'CARDS', 'YELLOW_CARDS', 'RED_CARDS'].includes(
          market,
        ),
      );
      const needsScorers = markets.includes('SCORER');
      const [homeSetPieces, awaySetPieces, homeSeasonProfile, awaySeasonProfile, homeScorers, awayScorers] =
        await Promise.all([
          needsStats
          ? this.setPieces(item.homeTeamId, homeRecent.slice(-8))
          : this.emptySetPieces(),
          needsStats
          ? this.setPieces(item.awayTeamId, awayRecent.slice(-8))
          : this.emptySetPieces(),
          this.seasonProfile(item.leagueId, item.homeTeamId, item.season),
          this.seasonProfile(item.leagueId, item.awayTeamId, item.season),
          needsScorers ? this.topScorers(item.homeTeamId, item.season) : Promise.resolve([]),
          needsScorers ? this.topScorers(item.awayTeamId, item.season) : Promise.resolve([]),
        ]);

      matches.push({
        fixtureId: item.fixtureId,
        league: {
          id: item.leagueId,
          name: item.leagueName,
          logoUrl: item.leagueLogoUrl ?? null,
          season: item.season,
        },
        kickoff: item.date,
        markets,
        historyDepth,
        teams: {
          home: this.teamBlock(
            item.homeTeamId,
            item.homeTeamName,
            item.homeTeamLogoUrl,
            homeRecent,
            homeSetPieces,
            homeSeasonProfile,
            homeScorers,
          ),
          away: this.teamBlock(
            item.awayTeamId,
            item.awayTeamName,
            item.awayTeamLogoUrl,
            awayRecent,
            awaySetPieces,
            awaySeasonProfile,
            awayScorers,
          ),
        },
        headToHead: this.h2hBlock(h2h, item.homeTeamId, item.awayTeamId),
      });
    }

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'API-Football',
        note: 'All numbers are calculated deterministically from API-Football responses.',
      },
      matches,
    };
  }

  private async teamFixtures(teamId: number, seasons: number[]) {
    const responses = await Promise.all(
      seasons.map((season) => this.football.teamFixtures(teamId, season).catch(() => null)),
    );

    return responses
      .flatMap((response) => (response?.response ?? []) as PlayedFixture[])
      .filter((fixture) => this.isPlayed(fixture))
      .sort((left, right) => {
        return String(left.fixture?.date ?? '').localeCompare(String(right.fixture?.date ?? ''));
      });
  }

  private async seasonProfile(leagueId: number, teamId: number, season: number) {
    const response = await this.football.teamStatistics(leagueId, teamId, season).catch(() => null);
    const profile = response?.response as
      | {
          fixtures?: {
            played?: { total?: number; home?: number; away?: number };
            wins?: { total?: number };
            draws?: { total?: number };
            loses?: { total?: number };
          };
          goals?: {
            for?: { total?: { total?: number }; average?: { total?: string } };
            against?: { total?: { total?: number }; average?: { total?: string } };
          };
          clean_sheet?: { total?: number };
          failed_to_score?: { total?: number };
          form?: string;
          biggest?: {
            wins?: { home?: string; away?: string };
            loses?: { home?: string; away?: string };
          };
        }
      | undefined;

    if (!profile?.fixtures) {
      return null;
    }

    return {
      matchesPlayed: {
        total: profile.fixtures.played?.total ?? null,
        home: profile.fixtures.played?.home ?? null,
        away: profile.fixtures.played?.away ?? null,
      },
      record: {
        wins: profile.fixtures.wins?.total ?? null,
        draws: profile.fixtures.draws?.total ?? null,
        losses: profile.fixtures.loses?.total ?? null,
      },
      goals: {
        forTotal: profile.goals?.for?.total?.total ?? null,
        forAverage: profile.goals?.for?.average?.total ?? null,
        againstTotal: profile.goals?.against?.total?.total ?? null,
        againstAverage: profile.goals?.against?.average?.total ?? null,
      },
      cleanSheets: profile.clean_sheet?.total ?? null,
      failedToScore: profile.failed_to_score?.total ?? null,
      form: profile.form ?? null,
      biggest: {
        win: {
          home: profile.biggest?.wins?.home ?? null,
          away: profile.biggest?.wins?.away ?? null,
        },
        loss: {
          home: profile.biggest?.loses?.home ?? null,
          away: profile.biggest?.loses?.away ?? null,
        },
      },
    };
  }

  private async topScorers(teamId: number, season: number) {
    const players: Array<{
      id: number;
      name: string;
      goals: number;
      appearances: number;
      currentClub: unknown;
    }> = [];

    for (let page = 1; page <= 3; page += 1) {
      const response = await this.football.playersByTeam(teamId, season, page).catch(() => null);
      const rows = (response?.response ?? []) as Array<{
        player?: { id?: number; name?: string };
        statistics?: Array<{
          team?: { id?: number };
          goals?: { total?: number | null };
          games?: { appearences?: number | null };
        }>;
      }>;

      rows.forEach((row) => {
        const playerId = row.player?.id;
        const name = row.player?.name;
        const mine = row.statistics?.filter((statistic) => statistic.team?.id === teamId) ?? [];
        const goals = mine.reduce((sum, statistic) => sum + Number(statistic.goals?.total ?? 0), 0);
        const appearances = mine.reduce(
          (sum, statistic) => sum + Number(statistic.games?.appearences ?? 0),
          0,
        );

        if (playerId && name && appearances > 0) {
          players.push({ id: playerId, name, goals, appearances, currentClub: null });
        }
      });

      if (page >= Number(response?.paging?.total ?? 1)) {
        break;
      }
    }

    const top = players.sort((left, right) => right.goals - left.goals).slice(0, 10);

    for (const player of top) {
      player.currentClub = await this.playerCurrentClub(player.id, season);
    }

    return top.map((player) => ({
      player: player.name,
      goalsWithTeam: player.goals,
      appearancesWithTeam: player.appearances,
      currentClub: player.currentClub,
    }));
  }

  private async playerCurrentClub(playerId: number, season: number) {
    const response = await this.football.playerById(playerId, season).catch(() => null);
    const stats = ((response?.response as Array<{
      statistics?: Array<{
        team?: { name?: string };
        goals?: { total?: number | null };
        games?: { appearences?: number | null };
      }>;
    }> | undefined)?.[0]?.statistics ?? []) as Array<{
      team?: { name?: string };
      goals?: { total?: number | null };
      games?: { appearences?: number | null };
    }>;
    const best = stats.sort(
      (left, right) => Number(right.games?.appearences ?? 0) - Number(left.games?.appearences ?? 0),
    )[0];
    const appearances = Number(best?.games?.appearences ?? 0);
    const goals = Number(best?.goals?.total ?? 0);

    if (!best) {
      return null;
    }

    return {
      team: best.team?.name ?? null,
      goals,
      appearances,
      goalsPerMatch: this.round(appearances ? goals / appearances : 0),
    };
  }

  private async setPieces(teamId: number, fixtures: PlayedFixture[]): Promise<TeamSetPieces> {
    const rows = await Promise.all(
      fixtures.map(async (fixture) => {
        const fixtureId = fixture.fixture?.id;

        if (!fixtureId) {
          return null;
        }

        const response = await this.football.fixtureStatistics(fixtureId).catch(() => null);
        const teamStats = (response?.response as Array<{
          team?: { id?: number };
          statistics?: Array<{ type?: string; value?: string | number | null }>;
        }> | undefined)?.find((entry) => entry.team?.id === teamId);

        const get = (type: string) => {
          const value = teamStats?.statistics?.find((statistic) => statistic.type === type)?.value;
          return typeof value === 'number' ? value : Number.parseInt(String(value ?? '0'), 10) || 0;
        };

        const home = fixture.teams?.home?.id === teamId;
        const halftime = fixture.score?.halftime;
        const firstHalfGoals =
          halftime?.home !== undefined && halftime.home !== null
            ? Number(halftime.home ?? 0) + Number(halftime.away ?? 0)
            : null;
        const totalGoals = Number(fixture.goals?.home ?? 0) + Number(fixture.goals?.away ?? 0);
        const secondHalfGoals =
          firstHalfGoals === null ? null : Math.max(0, totalGoals - firstHalfGoals);

        return {
          row: {
            date: fixture.fixture?.date?.slice(0, 10),
            competition: fixture.league?.name ?? null,
            condition: home ? 'HOME' : 'AWAY',
            opponent: home ? fixture.teams?.away?.name : fixture.teams?.home?.name,
            score: `${fixture.goals?.home}-${fixture.goals?.away}`,
            corners: get('Corner Kicks'),
            shotsOnTarget: get('Shots on Goal'),
            totalShots: get('Total Shots'),
            yellowCards: get('Yellow Cards'),
            redCards: get('Red Cards'),
            halftimeScore:
              halftime?.home !== undefined && halftime.home !== null
                ? `${halftime.home}-${halftime.away}`
                : null,
            firstHalfGoals,
            secondHalfGoals,
          },
          corners: get('Corner Kicks'),
          shots: get('Total Shots'),
          shotsOnTarget: get('Shots on Goal'),
          yellowCards: get('Yellow Cards'),
          redCards: get('Red Cards'),
        };
      }),
    );

    const stats = rows.filter(Boolean) as Array<
      Omit<
        TeamSetPieces,
        | 'sampleSize'
        | 'cornersThreshold80'
        | 'cornersPctOver80'
        | 'lastCorners'
        | 'shotsThreshold80'
        | 'shotsPctOver80'
        | 'lastShots'
        | 'shotsOnTargetThreshold80'
        | 'shotsOnTargetPctOver80'
        | 'lastShotsOnTarget'
        | 'yellowCardsThreshold80'
        | 'yellowCardsPctOver80'
        | 'lastYellowCards'
        | 'lastRedCards'
        | 'matchRows'
      > & { row: unknown }
    >;
    const corners = stats.map((stat) => stat.corners);
    const shots = stats.map((stat) => stat.shots);
    const shotsOnTarget = stats.map((stat) => stat.shotsOnTarget);
    const yellowCards = stats.map((stat) => stat.yellowCards);

    return {
      corners: this.average(corners),
      cornersThreshold80: this.average(corners) * 0.8,
      cornersPctOver80: this.percentOverThreshold(corners, this.average(corners) * 0.8),
      lastCorners: corners.at(-1) ?? null,
      shots: this.average(shots),
      shotsThreshold80: this.average(shots) * 0.8,
      shotsPctOver80: this.percentOverThreshold(shots, this.average(shots) * 0.8),
      lastShots: shots.at(-1) ?? null,
      shotsOnTarget: this.average(shotsOnTarget),
      shotsOnTargetThreshold80: this.average(shotsOnTarget) * 0.8,
      shotsOnTargetPctOver80: this.percentOverThreshold(
        shotsOnTarget,
        this.average(shotsOnTarget) * 0.8,
      ),
      lastShotsOnTarget: shotsOnTarget.at(-1) ?? null,
      yellowCards: this.average(yellowCards),
      yellowCardsThreshold80: this.average(yellowCards) * 0.8,
      yellowCardsPctOver80: this.percentOverThreshold(
        yellowCards,
        this.average(yellowCards) * 0.8,
      ),
      lastYellowCards: yellowCards.at(-1) ?? null,
      redCards: this.average(stats.map((stat) => stat.redCards)),
      lastRedCards: stats.map((stat) => stat.redCards).at(-1) ?? null,
      sampleSize: stats.length,
      matchRows: stats.map((stat) => stat.row),
    };
  }

  private teamBlock(
    teamId: number,
    name: string,
    logoUrl: string | undefined,
    fixtures: PlayedFixture[],
    setPieces: TeamSetPieces,
    seasonProfile: unknown,
    topScorers: unknown[],
  ) {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let points = 0;
    let btts = 0;
    let over25 = 0;
    let firstHalfGoals = 0;
    let secondHalfGoals = 0;
    let firstHalfSamples = 0;
    let secondHalfGoalMatches = 0;
    let homeFor = 0;
    let homeAgainst = 0;
    let homeMatches = 0;
    let awayFor = 0;
    let awayAgainst = 0;
    let awayMatches = 0;

    const goalsFor: number[] = [];
    const goalsAgainst: number[] = [];
    const totalGoals: number[] = [];

    fixtures.forEach((fixture) => {
      const scored = this.goalsFor(fixture, teamId);
      const conceded = this.goalsAgainst(fixture, teamId);
      const isHome = fixture.teams?.home?.id === teamId;

      goalsFor.push(scored);
      goalsAgainst.push(conceded);
      totalGoals.push(scored + conceded);

      if (isHome) {
        homeMatches += 1;
        homeFor += scored;
        homeAgainst += conceded;
      } else {
        awayMatches += 1;
        awayFor += scored;
        awayAgainst += conceded;
      }

      if (scored > conceded) {
        wins += 1;
        points += 3;
      } else if (scored === conceded) {
        draws += 1;
        points += 1;
      } else {
        losses += 1;
      }

      if (scored > 0 && conceded > 0) {
        btts += 1;
      }

      if (scored + conceded > 2.5) {
        over25 += 1;
      }

      const halftime = fixture.score?.halftime;
      if (halftime?.home !== undefined && halftime.home !== null) {
        firstHalfSamples += 1;
        const firstHalfTotal = Number(halftime.home ?? 0) + Number(halftime.away ?? 0);
        const secondHalfTotal = Math.max(0, scored + conceded - firstHalfTotal);
        firstHalfGoals += firstHalfTotal;
        secondHalfGoals += secondHalfTotal;

        if (secondHalfTotal > 0) {
          secondHalfGoalMatches += 1;
        }
      }
    });

    return {
      id: teamId,
      name,
      logoUrl: logoUrl ?? null,
      seasonProfile,
      form: {
        record: `${wins}-${draws}-${losses}`,
        pointsPerMatch: this.round(fixtures.length ? points / fixtures.length : 0),
        matchesAnalyzed: fixtures.length,
      },
      summary: {
        record: `${wins}-${draws}-${losses}`,
        goalsForPerMatch: this.round(this.average(goalsFor)),
        goalsAgainstPerMatch: this.round(this.average(goalsAgainst)),
        totalGoalsPerMatch: this.round(this.average(totalGoals)),
        over25Pct: this.percent(over25, fixtures.length),
        bttsPct: this.percent(btts, fixtures.length),
        cornersPerMatch: this.round(setPieces.corners),
        cornersThreshold80: this.round(setPieces.cornersThreshold80),
        cornersPctOver80: setPieces.cornersPctOver80,
        shotsOnTargetPerMatch: this.round(setPieces.shotsOnTarget),
        shotsOnTargetThreshold80: this.round(setPieces.shotsOnTargetThreshold80),
        shotsOnTargetPctOver80: setPieces.shotsOnTargetPctOver80,
        totalShotsPerMatch: this.round(setPieces.shots),
        totalShotsThreshold80: this.round(setPieces.shotsThreshold80),
        totalShotsPctOver80: setPieces.shotsPctOver80,
        yellowCardsPerMatch: this.round(setPieces.yellowCards),
        redCardsPerMatch: this.round(setPieces.redCards),
        firstHalfGoalsPerMatch: this.round(firstHalfSamples ? firstHalfGoals / firstHalfSamples : 0),
        secondHalfGoalsPerMatch: this.round(
          firstHalfSamples ? secondHalfGoals / firstHalfSamples : 0,
        ),
        secondHalfGoalPct: this.percent(secondHalfGoalMatches, firstHalfSamples),
      },
      goals: {
        forPerMatch: this.round(this.average(goalsFor)),
        againstPerMatch: this.round(this.average(goalsAgainst)),
        over25Pct: this.percent(over25, fixtures.length),
        bttsPct: this.percent(btts, fixtures.length),
        firstHalfGoalsPerMatch: this.round(firstHalfSamples ? firstHalfGoals / firstHalfSamples : 0),
        secondHalfGoalsPerMatch: this.round(
          firstHalfSamples ? secondHalfGoals / firstHalfSamples : 0,
        ),
      },
      setPieces: {
        cornersPerMatch: this.round(setPieces.corners),
        cornersThreshold80: this.round(setPieces.cornersThreshold80),
        cornersPctOver80: setPieces.cornersPctOver80,
        lastCorners: setPieces.lastCorners,
        shotsPerMatch: this.round(setPieces.shots),
        shotsThreshold80: this.round(setPieces.shotsThreshold80),
        shotsPctOver80: setPieces.shotsPctOver80,
        lastShots: setPieces.lastShots,
        shotsOnTargetPerMatch: this.round(setPieces.shotsOnTarget),
        shotsOnTargetThreshold80: this.round(setPieces.shotsOnTargetThreshold80),
        shotsOnTargetPctOver80: setPieces.shotsOnTargetPctOver80,
        lastShotsOnTarget: setPieces.lastShotsOnTarget,
        yellowCardsPerMatch: this.round(setPieces.yellowCards),
        yellowCardsThreshold80: this.round(setPieces.yellowCardsThreshold80),
        yellowCardsPctOver80: setPieces.yellowCardsPctOver80,
        lastYellowCards: setPieces.lastYellowCards,
        redCardsPerMatch: this.round(setPieces.redCards),
        lastRedCards: setPieces.lastRedCards,
        sampleSize: setPieces.sampleSize,
      },
      homeAwaySplit: {
        home: {
          goalsForPerMatch: this.round(homeMatches ? homeFor / homeMatches : 0),
          goalsAgainstPerMatch: this.round(homeMatches ? homeAgainst / homeMatches : 0),
          matches: homeMatches,
        },
        away: {
          goalsForPerMatch: this.round(awayMatches ? awayFor / awayMatches : 0),
          goalsAgainstPerMatch: this.round(awayMatches ? awayAgainst / awayMatches : 0),
          matches: awayMatches,
        },
      },
      matchRows: setPieces.matchRows,
      topScorers,
    };
  }

  private h2hBlock(fixtures: PlayedFixture[], homeTeamId: number, awayTeamId: number) {
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;
    let btts = 0;
    let over25 = 0;
    const totalGoals: number[] = [];

    fixtures.forEach((fixture) => {
      const homeGoals = this.goalsFor(fixture, homeTeamId);
      const awayGoals = this.goalsFor(fixture, awayTeamId);

      if (homeGoals > awayGoals) homeWins += 1;
      else if (awayGoals > homeGoals) awayWins += 1;
      else draws += 1;

      if (homeGoals > 0 && awayGoals > 0) btts += 1;
      if (homeGoals + awayGoals > 2.5) over25 += 1;
      totalGoals.push(homeGoals + awayGoals);
    });

    return {
      matches: fixtures.length,
      homeWins,
      draws,
      awayWins,
      avgTotalGoals: this.round(this.average(totalGoals)),
      bttsPct: this.percent(btts, fixtures.length),
      over25Pct: this.percent(over25, fixtures.length),
      detail: fixtures
        .slice(-20)
        .reverse()
        .map((fixture) => ({
          date: fixture.fixture?.date?.slice(0, 10),
          home: fixture.teams?.home?.name,
          away: fixture.teams?.away?.name,
          score: `${fixture.goals?.home}-${fixture.goals?.away}`,
          league: fixture.league?.name,
        })),
    };
  }

  private serializeRequest(request: {
    basketJson: string;
    defaultMarkets: string;
    resultJson: string | null;
    [key: string]: unknown;
  }) {
    return {
      ...request,
      basket: JSON.parse(request.basketJson),
      defaultMarkets: JSON.parse(request.defaultMarkets),
      result: request.resultJson ? JSON.parse(request.resultJson) : null,
      basketJson: undefined,
      resultJson: undefined,
    };
  }

  private estimateCalls(dto: CreateAnalysisRequestDto) {
    const heavyItems = dto.items.filter((item) => {
      const markets = item.marketsOverride?.length ? item.marketsOverride : dto.defaultMarkets;
      return markets.some((market) =>
        ['CORNERS', 'TOTAL_SHOTS', 'SHOTS_ON_TARGET', 'CARDS', 'YELLOW_CARDS', 'RED_CARDS'].includes(
          market,
        ),
      );
    }).length;
    const scorerItems = dto.items.filter((item) => {
      const markets = item.marketsOverride?.length ? item.marketsOverride : dto.defaultMarkets;
      return markets.includes('SCORER');
    }).length;

    return dto.items.length * 7 + heavyItems * 16 + scorerItems * 12;
  }

  private async validMarketKeys() {
    const markets = await this.prisma.market.findMany({
      where: { isEnabled: true },
      select: { key: true },
    });

    return new Set(markets.map((market) => market.key));
  }

  private isPlayed(fixture: PlayedFixture) {
    return fixture.goals?.home !== undefined && fixture.goals.home !== null && fixture.goals.away !== null;
  }

  private goalsFor(fixture: PlayedFixture, teamId: number) {
    return fixture.teams?.home?.id === teamId
      ? Number(fixture.goals?.home ?? 0)
      : Number(fixture.goals?.away ?? 0);
  }

  private goalsAgainst(fixture: PlayedFixture, teamId: number) {
    return fixture.teams?.home?.id === teamId
      ? Number(fixture.goals?.away ?? 0)
      : Number(fixture.goals?.home ?? 0);
  }

  private emptySetPieces(): Promise<TeamSetPieces> {
    return Promise.resolve({
      corners: 0,
      cornersThreshold80: 0,
      cornersPctOver80: 0,
      lastCorners: null,
      shots: 0,
      shotsThreshold80: 0,
      shotsPctOver80: 0,
      lastShots: null,
      shotsOnTarget: 0,
      shotsOnTargetThreshold80: 0,
      shotsOnTargetPctOver80: 0,
      lastShotsOnTarget: null,
      yellowCards: 0,
      yellowCardsThreshold80: 0,
      yellowCardsPctOver80: 0,
      lastYellowCards: null,
      redCards: 0,
      lastRedCards: null,
      sampleSize: 0,
      matchRows: [],
    });
  }

  private average(values: number[]) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private percent(value: number, total: number) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  private percentOverThreshold(values: number[], threshold: number) {
    return values.length
      ? this.percent(
          values.filter((value) => value >= threshold).length,
          values.length,
        )
      : 0;
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private audit(userId: string, action: string, metadata?: unknown) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  }
}
