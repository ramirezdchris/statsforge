import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type ApiFootballResponse<T> = {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[] | Record<string, unknown>;
  results: number;
  paging: { current: number; total: number };
  response: T;
};

type CacheTtl = 'stable' | 'short' | 'none';

@Injectable()
export class FootballService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('API_FOOTBALL_BASE_URL') ?? 'https://v3.football.api-sports.io';
    this.apiKey = config.get<string>('API_FOOTBALL_KEY') ?? '';
  }

  async leagues(query: Record<string, string | undefined>) {
    const data = await this.request<unknown[]>('/leagues', query, 'stable');

    await Promise.all(
      data.response.map((item) => {
        const league = item as {
          league?: { id?: number; name?: string; type?: string; logo?: string };
          country?: { name?: string; flag?: string };
        };

        if (!league.league?.id || !league.league.name) {
          return undefined;
        }

        return this.prisma.league.upsert({
          where: { id: league.league.id },
          update: {
            name: league.league.name,
            country: league.country?.name ?? 'Unknown',
            type: league.league.type,
            logoUrl: league.league.logo,
            flagUrl: league.country?.flag,
            fetchedAt: new Date(),
          },
          create: {
            id: league.league.id,
            name: league.league.name,
            country: league.country?.name ?? 'Unknown',
            type: league.league.type,
            logoUrl: league.league.logo,
            flagUrl: league.country?.flag,
          },
        });
      }),
    );

    return data;
  }

  async teams(query: Record<string, string | undefined>) {
    const data = await this.request<unknown[]>('/teams', query, 'stable');
    const leagueId = query.league ? Number(query.league) : undefined;

    await Promise.all(
      data.response.map((item) => {
        const team = item as {
          team?: { id?: number; name?: string; code?: string; country?: string; logo?: string };
        };

        if (!team.team?.id || !team.team.name) {
          return undefined;
        }

        return this.prisma.team.upsert({
          where: { id: team.team.id },
          update: {
            leagueId,
            name: team.team.name,
            code: team.team.code,
            country: team.team.country,
            logoUrl: team.team.logo,
            fetchedAt: new Date(),
          },
          create: {
            id: team.team.id,
            leagueId,
            name: team.team.name,
            code: team.team.code,
            country: team.team.country,
            logoUrl: team.team.logo,
          },
        });
      }),
    );

    return data;
  }

  fixtures(query: Record<string, string | undefined>) {
    return this.request<unknown[]>('/fixtures', query, 'short');
  }

  headToHead(homeTeamId: number, awayTeamId: number) {
    return this.request<unknown[]>('/fixtures/headtohead', { h2h: `${homeTeamId}-${awayTeamId}` }, 'stable');
  }

  fixtureStatistics(fixtureId: number) {
    return this.request<unknown[]>('/fixtures/statistics', { fixture: String(fixtureId) }, 'stable');
  }

  teamStatistics(leagueId: number, teamId: number, season: number) {
    return this.request<unknown>('/teams/statistics', {
      league: String(leagueId),
      team: String(teamId),
      season: String(season),
    }, 'stable');
  }

  teamFixtures(teamId: number, season: number) {
    return this.request<unknown[]>('/fixtures', { team: String(teamId), season: String(season) }, 'stable');
  }

  playersByTeam(teamId: number, season: number, page = 1) {
    return this.request<unknown[]>('/players', {
      team: String(teamId),
      season: String(season),
      page: String(page),
    }, 'stable');
  }

  playerById(playerId: number, season: number) {
    return this.request<unknown[]>('/players', {
      id: String(playerId),
      season: String(season),
    }, 'stable');
  }

  async request<T>(
    endpoint: string,
    query: Record<string, string | number | undefined>,
    ttl: CacheTtl,
  ): Promise<ApiFootballResponse<T>> {
    const normalizedQuery = this.normalizeQuery(query);
    const key = this.cacheKey(endpoint, normalizedQuery);

    if (ttl !== 'none') {
      const cached = await this.prisma.apiCache.findUnique({ where: { key } });

      if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
        return JSON.parse(cached.responseJson) as ApiFootballResponse<T>;
      }
    }

    if (!this.apiKey) {
      throw new ServiceUnavailableException('API_FOOTBALL_KEY is not configured');
    }

    const url = new URL(endpoint, this.baseUrl);
    Object.entries(normalizedQuery).forEach(([name, value]) => {
      url.searchParams.set(name, String(value));
    });

    const response = await fetch(url, {
      headers: { 'x-apisports-key': this.apiKey },
    });

    if (!response.ok) {
      throw new BadGatewayException(`API-Football HTTP ${response.status}`);
    }

    const data = (await response.json()) as ApiFootballResponse<T>;
    const errors = data.errors;
    const hasErrors = Array.isArray(errors) ? errors.length > 0 : Object.keys(errors ?? {}).length > 0;

    if (hasErrors) {
      throw new BadGatewayException({ message: 'API-Football returned errors', errors });
    }

    await this.prisma.apiCache.upsert({
      where: { key },
      update: {
        endpoint,
        queryJson: JSON.stringify(normalizedQuery),
        responseJson: JSON.stringify(data),
        expiresAt: this.expiresAt(ttl),
      },
      create: {
        key,
        endpoint,
        queryJson: JSON.stringify(normalizedQuery),
        responseJson: JSON.stringify(data),
        expiresAt: this.expiresAt(ttl),
      },
    });

    return data;
  }

  private normalizeQuery(query: Record<string, string | number | undefined>): Record<string, string | number> {
    return Object.entries(query)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, string | number>>((normalized, [name, value]) => {
        normalized[name] = value;
        return normalized;
      }, {});
  }

  private cacheKey(endpoint: string, query: Record<string, string | number>) {
    return `${endpoint}:${JSON.stringify(query)}`;
  }

  private expiresAt(ttl: CacheTtl) {
    if (ttl === 'stable') {
      return null;
    }

    if (ttl === 'short') {
      return new Date(Date.now() + 30 * 60 * 1000);
    }

    return new Date();
  }
}
