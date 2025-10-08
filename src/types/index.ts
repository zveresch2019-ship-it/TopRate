// Типы для приложения рейтинга игроков

export enum MatchResult {
  WIN = 'WIN',
  LOSS = 'LOSS',
  DRAW = 'DRAW'
}

export interface Player {
  id: string;
  name: string;
  rating: number;
  seasonStartRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsConceded: number;
  dateCreated: Date;
  lastRatingChange: number;
}

export interface Match {
  id: string;
  date: string;
  homeTeam: Team;
  awayTeam: Team;
  competition: string;
}

export interface Team {
  playerIds: string[];
  score: number;
}

export interface MatchData {
  homeScore: number;
  awayScore: number;
  homeTeam: string[];
  awayTeam: string[];
}

export interface Season {
  id: string;
  number: number;
  name: string;
  startDate: Date;
  isActive: boolean;
  totalMatches: number;
  averageRating: number;
}

export interface RatingContextType {
  players: Player[];
  matches: Match[];
  seasons: Season[];
  currentSeason: Season | null;
  addPlayer: (name: string, rating: number) => Promise<boolean>;
  editPlayer: (id: string, name: string, rating: number) => Promise<boolean>;
  removePlayer: (playerId: string) => Promise<void>;
  addMatch: (
    homeTeam: {playerIds: string[]},
    awayTeam: {playerIds: string[]},
    homeScore: number,
    awayScore: number,
    competition: string
  ) => Promise<boolean>;
  deleteMatch: (matchId: string) => Promise<boolean>;
  startNewSeason: () => Promise<boolean>;
  getTotalMatches: () => number;
  getAverageRating: () => number;
  getPlayersByRating: () => Player[];
  getSeasonMatches: (seasonId: string) => Match[];
  isLoading: boolean;
}

// Типы для аутентификации
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthContextType {
  currentUser: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchUser: (username: string) => Promise<boolean>;
  getAvailableUsers: () => Promise<string[]>;
}