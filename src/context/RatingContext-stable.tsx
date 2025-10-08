import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Player, Match, MatchResult, RatingContextType, Team, Season} from '../types';
import {useAuth} from './AuthContext';

const RatingContext = createContext<RatingContextType | undefined>(undefined);

interface RatingProviderProps {
  children: ReactNode;
}

const getStorageKeys = (userId: string) => ({
  PLAYERS: `football_rating_players_${userId}`,
  MATCHES: `football_rating_matches_${userId}`,
  SEASONS: `football_rating_seasons_${userId}`,
  CURRENT_SEASON: `football_rating_current_season_${userId}`,
  SEASON_MATCHES: `football_rating_season_matches_${userId}`,
});

export const RatingProvider: React.FC<RatingProviderProps> = ({children}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [seasonMatches, setSeasonMatches] = useState<{[seasonId: string]: Match[]}>({});
  const {currentUser} = useAuth();

  // Загрузка данных при запуске
  useEffect(() => {
    if (currentUser) {
      loadData();
    } else {
      setPlayers([]);
      setMatches([]);
      setSeasons([]);
      setCurrentSeason(null);
      setSeasonMatches({});
    }
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) return;
    
    try {
      const keys = getStorageKeys(currentUser.id);
      const [playersData, matchesData, seasonsData, currentSeasonData, seasonMatchesData] = await Promise.all([
        AsyncStorage.getItem(keys.PLAYERS),
        AsyncStorage.getItem(keys.MATCHES),
        AsyncStorage.getItem(keys.SEASONS),
        AsyncStorage.getItem(keys.CURRENT_SEASON),
        AsyncStorage.getItem(keys.SEASON_MATCHES),
      ]);
      
      if (playersData) setPlayers(JSON.parse(playersData));
      if (matchesData) setMatches(JSON.parse(matchesData));
      if (seasonsData) setSeasons(JSON.parse(seasonsData));
      if (currentSeasonData) setCurrentSeason(JSON.parse(currentSeasonData));
      if (seasonMatchesData) setSeasonMatches(JSON.parse(seasonMatchesData));
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  const saveData = async () => {
    if (!currentUser) return;
    
    try {
      const storageKeys = getStorageKeys(currentUser.id);
      const playersData = JSON.stringify(players);
      const matchesData = JSON.stringify(matches);
      const seasonsData = JSON.stringify(seasons);
      const seasonMatchesData = JSON.stringify(seasonMatches);
      const currentSeasonData = currentSeason ? JSON.stringify(currentSeason) : null;
      
      await AsyncStorage.setItem(storageKeys.PLAYERS, playersData);
      await AsyncStorage.setItem(storageKeys.MATCHES, matchesData);
      await AsyncStorage.setItem(storageKeys.SEASONS, seasonsData);
      await AsyncStorage.setItem(storageKeys.SEASON_MATCHES, seasonMatchesData);
      if (currentSeasonData) {
        await AsyncStorage.setItem(storageKeys.CURRENT_SEASON, currentSeasonData);
      }
    } catch (error) {
      console.error('Ошибка сохранения данных:', error);
    }
  };

  // Сохранение данных при изменении
  useEffect(() => {
    if (currentUser) {
      saveData();
    }
  }, [players, matches, seasons, currentSeason, seasonMatches]);

  const addPlayer = async (name: string, initialRating: number = 1500): Promise<boolean> => {
    const trimmedName = name.trim();
    if (players.some(player => player.name.toLowerCase() === trimmedName.toLowerCase())) {
      return false;
    }

    if (initialRating < 1000 || initialRating > 2000) {
      return false;
    }

    const newPlayer: Player = {
      id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      rating: initialRating,
      seasonStartRating: initialRating,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsScored: 0,
      goalsConceded: 0,
      dateCreated: new Date(),
      lastRatingChange: 0,
    };

    setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
    return true;
  };

  const deletePlayer = async (id: string): Promise<void> => {
    setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== id));
  };

  const calculateAllPlayerRatingChanges = (
    homeTeam: Team,
    awayTeam: Team,
    homeScore: number,
    awayScore: number,
  ): {[playerId: string]: number} => {
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      return {};
    }
    
    const sumA = homeTeam.totalRating;
    const sumB = awayTeam.totalRating;
    
    let adjustedScoreA = homeScore;
    let adjustedScoreB = awayScore;
    if (adjustedScoreA === 0 && adjustedScoreB === 0) {
      adjustedScoreA = 1;
      adjustedScoreB = 1;
    }
    
    const isTeamAWinner = adjustedScoreA > adjustedScoreB;
    const winnerSum = isTeamAWinner ? sumA : sumB;
    const loserSum = isTeamAWinner ? sumB : sumA;
    const winnerScore = isTeamAWinner ? adjustedScoreA : adjustedScoreB;
    const loserScore = isTeamAWinner ? adjustedScoreB : adjustedScoreA;
    const winnerIds = isTeamAWinner ? homeTeam.playerIds : awayTeam.playerIds;
    const loserIds = isTeamAWinner ? awayTeam.playerIds : homeTeam.playerIds;
    
    const RD = winnerSum - loserSum;
    const totalPlayers = homeTeam.playerIds.length + awayTeam.playerIds.length;
    const ES = (RD / (totalPlayers / 2)) / 200 * 6;
    const goalDiff = winnerScore - loserScore;
    const goalRatio = loserScore / winnerScore;
    const RGD = goalDiff * ((0.8 - goalRatio) + 1);
    const GV = 7 * ((12 - totalPlayers) / 10 + 1);
    const TV = (totalPlayers / 2) * GV * (RGD - ES);
    
    // Рассчитываем изменения рейтингов для каждого игрока
    const changes: {[playerId: string]: number} = {};
    
    // Для игроков победившей команды
    const winnerTotalRating = winnerIds.reduce((acc, id) => acc + (players.find(p => p.id === id)?.rating || 0), 0);
    winnerIds.forEach(id => {
      const player = players.find(p => p.id === id);
      if (player) {
        const playerShare = player.rating / winnerTotalRating;
        const change = Math.round(TV * playerShare);
        changes[id] = change;
      }
    });
    
    // Для игроков проигравшей команды
    const loserTotalRating = loserIds.reduce((acc, id) => acc + (players.find(p => p.id === id)?.rating || 0), 0);
    loserIds.forEach(id => {
      const player = players.find(p => p.id === id);
      if (player) {
        const playerShare = player.rating / loserTotalRating;
        const change = Math.round(-TV * playerShare);
        changes[id] = change;
      }
    });

    return changes;
  };

  const editPlayer = async (id: string, name: string, rating: number): Promise<boolean> => {
    const trimmedName = name.trim();
    if (players.some(player => player.id !== id && player.name.toLowerCase() === trimmedName.toLowerCase())) {
      return false;
    }

    if (rating < 1000 || rating > 2000) {
      return false;
    }

    setPlayers(prevPlayers =>
      prevPlayers.map(player =>
        player.id === id ? {...player, name: trimmedName, rating} : player,
      ),
    );
    return true;
  };

  const addMatch = async (
    homeTeam: Team,
    awayTeam: Team,
    homeScore: number,
    awayScore: number,
    competition?: string,
  ): Promise<boolean> => {
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      return false;
    }

    if (homeScore < 0 || awayScore < 0) {
      return false;
    }

    // Рассчитываем изменения рейтинга для всех игроков
    const ratingChanges = calculateAllPlayerRatingChanges(homeTeam, awayTeam, homeScore, awayScore);

    const match: Match = {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      date: new Date(),
      competition: competition || 'Товарищеский матч',
      ratingChanges,
      seasonId: currentSeason?.id || '',
    };

    setMatches(prevMatches => [...prevMatches, match]);

    // Обновляем статистику всех игроков
    setPlayers(prevPlayers =>
      prevPlayers.map(player => {
        const change = ratingChanges[player.id];
        if (change !== undefined) {
          const result = homeTeam.playerIds.includes(player.id) 
            ? (homeScore > awayScore ? MatchResult.WIN : homeScore === awayScore ? MatchResult.DRAW : MatchResult.LOSS)
            : (awayScore > homeScore ? MatchResult.WIN : homeScore === awayScore ? MatchResult.DRAW : MatchResult.LOSS);
          
          let wins = player.wins;
          let draws = player.draws;
          let losses = player.losses;

          if (result === MatchResult.WIN) {
            wins++;
          } else if (result === MatchResult.DRAW) {
            draws++;
          } else {
            losses++;
          }

          return {
            ...player,
            matchesPlayed: player.matchesPlayed + 1,
            wins,
            draws,
            losses,
            goalsScored: player.goalsScored + (homeTeam.playerIds.includes(player.id) ? homeScore : awayScore),
            goalsConceded: player.goalsConceded + (homeTeam.playerIds.includes(player.id) ? awayScore : homeScore),
            rating: player.rating + change,
            lastRatingChange: change,
          };
        }
        return {
          ...player,
          lastRatingChange: 0,
        };
      })
    );

    return true;
  };

  const deleteMatch = async (id: string): Promise<boolean> => {
    // Находим матч для отмены
    const matchToDelete = matches.find(match => match.id === id);
    if (!matchToDelete) return false;

    // Отменяем изменения рейтингов для всех игроков
    setPlayers(prevPlayers =>
      prevPlayers.map(player => {
        const change = matchToDelete.ratingChanges[player.id];
        if (change !== undefined) {
          // Возвращаем рейтинг к значению до матча
          const newRating = player.rating - change;
          
          // Определяем результат матча для игрока
          const isPlayerInHomeTeam = matchToDelete.homeTeam.playerIds.includes(player.id);
          const isPlayerWinner = isPlayerInHomeTeam 
            ? matchToDelete.homeScore > matchToDelete.awayScore
            : matchToDelete.awayScore > matchToDelete.homeScore;
          const isDraw = matchToDelete.homeScore === matchToDelete.awayScore;
          
          // Обновляем статистику
          let wins = player.wins;
          let draws = player.draws;
          let losses = player.losses;

          if (isPlayerWinner) {
            wins = Math.max(0, wins - 1);
          } else if (isDraw) {
            draws = Math.max(0, draws - 1);
          } else {
            losses = Math.max(0, losses - 1);
          }

          return {
            ...player,
            rating: newRating,
            matchesPlayed: Math.max(0, player.matchesPlayed - 1),
            wins,
            draws,
            losses,
            goalsScored: player.goalsScored - (isPlayerInHomeTeam ? matchToDelete.homeScore : matchToDelete.awayScore),
            goalsConceded: player.goalsConceded - (isPlayerInHomeTeam ? matchToDelete.awayScore : matchToDelete.homeScore),
            lastRatingChange: 0,
          };
        }
        return {
          ...player,
          lastRatingChange: 0,
        };
      })
    );

    // Удаляем матч
    setMatches(prevMatches => prevMatches.filter(match => match.id !== id));
    return true;
  };

  const getTotalMatches = (): number => {
    return matches.length;
  };

  const getAverageRating = (): number => {
    if (players.length === 0) return 0;
    const totalRating = players.reduce((sum, player) => sum + player.rating, 0);
    return Math.round(totalRating / players.length);
  };

  const getPlayersByRating = (): Player[] => {
    return [...players].sort((a, b) => b.rating - a.rating);
  };

  const getMatchesByDate = (): Match[] => {
    return [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getSeasonMatches = (seasonId: string): Match[] => {
    return seasonMatches[seasonId] || [];
  };

  const reloadData = async () => {
    if (currentUser) {
      await loadData();
    }
  };

  const startNewSeason = async (): Promise<boolean> => {
    try {
      setPlayers(prevPlayers => 
        prevPlayers.map(player => ({
          ...player,
          seasonStartRating: player.rating,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsScored: 0,
          goalsConceded: 0,
          lastRatingChange: 0,
        }))
      );

      setMatches([]);
      setSeasonMatches({});

      const newSeason: Season = {
        id: `season_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        number: seasons.length + 1,
        name: `Сезон ${new Date().getFullYear()}`,
        startDate: new Date(),
        isActive: true,
        totalMatches: 0,
        averageRating: getAverageRating(),
      };

      setSeasons(prevSeasons => [...prevSeasons, newSeason]);
      setCurrentSeason(newSeason);

      return true;
    } catch (error) {
      console.error('Ошибка при создании нового сезона:', error);
      return false;
    }
  };

  const value: RatingContextType = {
    players,
    matches,
    seasons,
    currentSeason,
    addPlayer,
    removePlayer: deletePlayer,
    addMatch,
    removeMatch: deleteMatch,
    deleteMatch,
    editPlayer,
    getTotalMatches,
    getAverageRating,
    getPlayersByRating,
    getMatchesByDate,
    getSeasonMatches,
    reloadData,
    startNewSeason,
    // Добавляем недостающие методы с заглушками
    getPlayerRanking: getPlayersByRating,
    getPlayerMatches: () => [],
    getRecentMatches: () => [],
    getTotalPlayers: () => players.length,
    addPredefinedPlayers: async () => {},
    getCurrentSeasonStats: () => ({totalMatches: 0, averageRating: 0}),
    getAllSeasonMatches: () => [],
    editMatch: async () => false,
    addSeason: async () => false,
    updateSeason: async () => false,
    deleteSeason: async () => false,
    setCurrentSeasonById: async () => false,
    addMatchToSeason: async () => false,
    removeMatchFromSeason: async () => false,
  };

  return <RatingContext.Provider value={value}>{children}</RatingContext.Provider>;
};

export const useRating = (): RatingContextType => {
  const context = useContext(RatingContext);
  if (context === undefined) {
    throw new Error('useRating must be used within a RatingProvider');
  }
  return context;
};
