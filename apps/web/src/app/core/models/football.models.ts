export interface ApiFootballWrapper<T> {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown[] | Record<string, unknown>;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

export interface FootballLeague {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string | null;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
}

export interface FootballTeam {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    logo: string | null;
  };
}

export interface FootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
  };
  league: {
    id: number;
    name: string;
    logo: string | null;
    season: number;
  };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
}

export interface Market {
  key: string;
  label: string;
  description: string | null;
  category: string;
}

export interface BasketItem {
  fixtureId: number;
  leagueId: number;
  leagueName: string;
  leagueLogoUrl?: string | null;
  season: number;
  date: string;
  homeTeamId: number;
  homeTeamName: string;
  homeTeamLogoUrl?: string | null;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamLogoUrl?: string | null;
  marketsOverride?: string[];
  historyDepthOverride?: number;
}

export interface AnalysisRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  basket: BasketItem[];
  defaultMarkets: string[];
  historyDepth: number;
  includeExcel: boolean;
  deliveryChannel: 'APP' | 'TELEGRAM' | 'BOTH';
  message: string | null;
  rejectionReason: string | null;
  estimatedCalls: number | null;
  result: unknown | null;
  createdAt: string;
  requester?: { email: string; name: string; role: string };
  reviewer?: { email: string; name: string; role: string } | null;
}
