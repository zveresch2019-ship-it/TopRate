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

  console.log('RatingProvider: players =', players);
  console.log('RatingProvider: matches =', matches);
  console.log('RatingProvider: currentUser =', currentUser);

  // Загрузка данных при запуске
  useEffect(() => {
    if (currentUser) {
      console.log('RatingProvider: useEffect loadData for user:', currentUser.username);
      console.log('RatingProvider: currentUser.id:', currentUser.id);
      loadData();
    } else {
      console.log('RatingProvider: currentUser is null, clearing data');
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
      console.log('RatingProvider: loadData started for user:', currentUser.id);
      const keys = getStorageKeys(currentUser.id);
      console.log('RatingProvider: storage keys:', keys);
      
      // Проверим, есть ли вообще данные в AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('RatingProvider: all AsyncStorage keys:', allKeys);
      
      const [playersData, matchesData, seasonsData, currentSeasonData, seasonMatchesData] = await Promise.all([
        AsyncStorage.getItem(keys.PLAYERS),
        AsyncStorage.getItem(keys.MATCHES),
        AsyncStorage.getItem(keys.SEASONS),
        AsyncStorage.getItem(keys.CURRENT_SEASON),
        AsyncStorage.getItem(keys.SEASON_MATCHES),
      ]);
      
      console.log('RatingProvider: playersData =', playersData);
      console.log('RatingProvider: matchesData =', matchesData);
      console.log('RatingProvider: seasonsData =', seasonsData);
      
      if (playersData) {
        const parsedPlayers = JSON.parse(playersData);
        console.log('RatingProvider: parsed players =', parsedPlayers);
        setPlayers(parsedPlayers);
      } else {
        console.log('RatingProvider: no players data found');
      }
      
      if (matchesData) {
        const parsedMatches = JSON.parse(matchesData);
        console.log('RatingProvider: parsed matches =', parsedMatches);
        setMatches(parsedMatches);
      } else {
        console.log('RatingProvider: no matches data found');
      }
      
      if (seasonsData) {
        const parsedSeasons = JSON.parse(seasonsData);
        console.log('RatingProvider: parsed seasons =', parsedSeasons);
        setSeasons(parsedSeasons);
      } else {
        console.log('RatingProvider: no seasons data found');
      }
      
      if (currentSeasonData) {
        const parsedCurrentSeason = JSON.parse(currentSeasonData);
        console.log('RatingProvider: parsed currentSeason =', parsedCurrentSeason);
        setCurrentSeason(parsedCurrentSeason);
      } else {
        console.log('RatingProvider: no currentSeason data found');
      }
      
      if (seasonMatchesData) {
        const parsedSeasonMatches = JSON.parse(seasonMatchesData);
        console.log('RatingProvider: parsed seasonMatches =', parsedSeasonMatches);
        setSeasonMatches(parsedSeasonMatches);
      } else {
        console.log('RatingProvider: no seasonMatches data found');
      }
      
      console.log('RatingProvider: loadData completed');
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  // Сохранение данных при изменении
  useEffect(() => {
    saveData();
  }, [players, matches, seasons, currentSeason, seasonMatches]);


  const saveData = async () => {
    if (!currentUser) return;
    
    try {
      const storageKeys = getStorageKeys(currentUser.id);
      await AsyncStorage.setItem(storageKeys.PLAYERS, JSON.stringify(players));
      await AsyncStorage.setItem(storageKeys.MATCHES, JSON.stringify(matches));
      await AsyncStorage.setItem(storageKeys.SEASONS, JSON.stringify(seasons));
      await AsyncStorage.setItem(storageKeys.SEASON_MATCHES, JSON.stringify(seasonMatches));
      if (currentSeason) {
        await AsyncStorage.setItem(storageKeys.CURRENT_SEASON, JSON.stringify(currentSeason));
      }
    } catch (error) {
      console.error('Ошибка сохранения данных:', error);
    }
  };


  const updatePlayerStats = (
    playerId: string,
    score: number,
    opponentScore: number,
    result: MatchResult,
  ) => {
    setPlayers(prevPlayers =>
      prevPlayers.map(player => {
        if (player.id === playerId) {
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
            goalsScored: player.goalsScored + score,
            goalsConceded: player.goalsConceded + opponentScore,
          };
        }
        return player;
      }),
    );
  };


  const addPlayer = async (name: string, initialRating: number = 1500): Promise<boolean> => {
    const trimmedName = name.trim();
    if (players.some(player => player.name.toLowerCase() === trimmedName.toLowerCase())) {
      console.log('addPlayer: игрок с именем уже существует:', trimmedName);
      return false; // Игрок с таким именем уже существует
    }

    if (initialRating < 1000 || initialRating > 2000) {
      console.error('Начальный рейтинг должен быть от 1000 до 2000');
      return false;
    }

    const newPlayer: Player = {
      id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 10000)}`,
      name: trimmedName,
      rating: initialRating,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsScored: 0,
      goalsConceded: 0,
      dateCreated: new Date(),
      lastRatingChange: 0,
    };
    setPlayers(prev => [...prev, newPlayer]);
    return true;
  };

  const removePlayer = async (playerId: string): Promise<void> => {
    setPlayers(prev => prev.filter(player => player.id !== playerId));
    setMatches(prev =>
      prev.filter(
        match => 
          !match.homeTeam.playerIds.includes(playerId) && 
          !match.awayTeam.playerIds.includes(playerId),
      ),
    );
  };

  const editPlayer = async (playerId: string, newName: string, newRating: number): Promise<boolean> => {
    // Проверяем, что новое имя не совпадает с существующими игроками (кроме текущего)
    const existingPlayer = players.find(p => p.name === newName && p.id !== playerId);
    if (existingPlayer) {
      return false; // Игрок с таким именем уже существует
    }

    // Проверяем диапазон рейтинга
    if (newRating < 1000 || newRating > 2000) {
      console.error('Рейтинг должен быть от 1000 до 2000');
      return false;
    }

    setPlayers(prev => prev.map(player => 
      player.id === playerId 
        ? { ...player, name: newName, rating: newRating }
        : player
    ));
    return true;
  };

  const calculateTeamRatingChanges = (
    homeTeam: Team,
    awayTeam: Team,
    homeScore: number,
    awayScore: number,
  ): {[playerId: string]: number} => {
    const ratingChanges: {[playerId: string]: number} = {};

    // Получаем данные игроков команд
    const homePlayers = players.filter(p => homeTeam.playerIds.includes(p.id));
    const awayPlayers = players.filter(p => awayTeam.playerIds.includes(p.id));

    if (homePlayers.length === 0 || awayPlayers.length === 0) {
      return ratingChanges;
    }

    // Оригинальная формула пользователя
    const sumA = homeTeam.totalRating;
    const sumB = awayTeam.totalRating;
    
    // Обрабатываем случай 0-0 как 1-1
    let adjustedScoreA = homeScore;
    let adjustedScoreB = awayScore;
    if (homeScore === 0 && awayScore === 0) {
      adjustedScoreA = 1;
      adjustedScoreB = 1;
    }
    
    // Определяем победителя и проигравшего (при ничьей считаем команду A победителем)
    const isTeamAWinner = adjustedScoreA >= adjustedScoreB;
    const winnerSum = isTeamAWinner ? sumA : sumB;
    const loserSum = isTeamAWinner ? sumB : sumA;
    const winnerScore = isTeamAWinner ? adjustedScoreA : adjustedScoreB;
    const loserScore = isTeamAWinner ? adjustedScoreB : adjustedScoreA;
    const winnerIds = isTeamAWinner ? homeTeam.playerIds : awayTeam.playerIds;
    const loserIds = isTeamAWinner ? awayTeam.playerIds : homeTeam.playerIds;
    
    // 1. Разность рейтингов (RD)
    const RD = winnerSum - loserSum;
    
    // 2. Ожидаемая разница в голах (ES)
    const totalPlayers = homeTeam.playerIds.length + awayTeam.playerIds.length;
    const ES = (RD / (totalPlayers / 2)) / 200 * 6;
    
    // 3. Разность голов с учетом отношения (RGD)
    const goalDiff = winnerScore - loserScore;
    const goalRatio = loserScore / winnerScore;
    const RGD = goalDiff * ((0.8 - goalRatio) + 1);
    
    // 4. Цена гола (GV)
    const GV = 7 * ((12 - totalPlayers) / 10 + 1);
    
    // 5. Итоговая сумма (TV)
    const TV = (totalPlayers / 2) * GV * (RGD - ES);
    
    // Рассчитываем изменения рейтингов для каждого игрока
    const changes: {[playerId: string]: number} = {};
    
    // Для игроков победившей команды
    const winnerTotalRating = winnerIds.reduce((acc, id) => acc + (players.find(p => p.id === id)?.rating || 0), 0);
    winnerIds.forEach(id => {
      const player = players.find(p => p.id === id);
      if (player) {
        // Распределяем TV пропорционально рейтингу игрока
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
        // Распределяем TV пропорционально рейтингу игрока (отрицательно)
        const playerShare = player.rating / loserTotalRating;
        const change = Math.round(-TV * playerShare);
        changes[id] = change;
      }
    });

    // Логируем параметры для тестирования
    console.log('=== ПАРАМЕТРЫ РАСЧЕТА ===');
    console.log('RD (Разность рейтингов):', RD);
    console.log('ES (Ожидаемая разница):', ES.toFixed(2));
    console.log('RGD (Реальная разность):', RGD.toFixed(2));
    console.log('GV (Цена гола):', GV.toFixed(2));
    console.log('TV (Итоговая сумма):', Math.round(TV));
    console.log('Счет:', `${adjustedScoreA}:${adjustedScoreB}`);
    console.log('Победитель:', isTeamAWinner ? 'Команда A' : 'Команда B');
    console.log('Изменения:', changes);
    console.log('========================');

    return changes;
  };

  const createFirstSeason = async () => {
    const now = new Date();
    const seasonNumber = 1;
    const seasonName = `Сезон ${seasonNumber} (${now.toLocaleDateString('ru-RU', { month: '2-digit', year: 'numeric' })})`;
    
    const newSeason: Season = {
      id: `season_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      number: seasonNumber,
      name: seasonName,
      startDate: now,
      isActive: true,
      totalMatches: 0,
      averageRating: 1500,
    };

    setSeasons([newSeason]);
    setCurrentSeason(newSeason);
  };

  const startNewSeason = async (): Promise<boolean> => {
    if (!currentSeason) return false;

    try {
      // Завершаем текущий сезон
      const updatedCurrentSeason = {
        ...currentSeason,
        endDate: new Date(),
        isActive: false,
      };

      // Создаем новый сезон
      const now = new Date();
      const newSeasonNumber = seasons.length + 1;
      const newSeasonName = `Сезон ${newSeasonNumber} (${now.toLocaleDateString('ru-RU', { month: '2-digit', year: 'numeric' })})`;
      
      const newSeason: Season = {
        id: `season_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        number: newSeasonNumber,
        name: newSeasonName,
        startDate: now,
        isActive: true,
        totalMatches: 0,
        averageRating: players.length > 0 ? players.reduce((sum, p) => sum + p.rating, 0) / players.length : 1500,
      };

      // Сохраняем матчи текущего сезона в историю
      setSeasonMatches(prev => ({
        ...prev,
        [currentSeason.id]: [...matches],
      }));

      // Обновляем сезоны
      setSeasons(prev => [...prev.filter(s => s.id !== currentSeason.id), updatedCurrentSeason, newSeason]);
      setCurrentSeason(newSeason);

      // Сбрасываем статистику матчей игроков (но сохраняем рейтинг)
      setPlayers(prev => prev.map(player => ({
        ...player,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        lastRatingChange: 0,
      })));

      // Очищаем текущие матчи (они сохранены в истории сезонов)
      setMatches([]);

      return true;
    } catch (error) {
      console.error('Ошибка создания нового сезона:', error);
      return false;
    }
  };

  const getCurrentSeasonStats = () => {
    if (!currentSeason) {
      return { totalMatches: 0, averageRating: 0 };
    }

    const totalMatches = matches.length; // Текущие матчи
    const averageRating = players.length > 0 ? players.reduce((sum, p) => sum + p.rating, 0) / players.length : 0;

    return { totalMatches, averageRating };
  };

  const getSeasonMatches = (seasonId: string): Match[] => {
    return seasonMatches[seasonId] || [];
  };

  const getAllSeasonMatches = (): Match[] => {
    // Возвращаем все матчи из всех сезонов + текущие матчи
    const allMatches: Match[] = [];
    
    // Добавляем матчи из истории сезонов
    Object.values(seasonMatches).forEach(seasonMatchList => {
      allMatches.push(...seasonMatchList);
    });
    
    // Добавляем текущие матчи
    allMatches.push(...matches);
    
    return allMatches.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const addMatch = async (
    homeTeam: Team,
    awayTeam: Team,
    homeScore: number,
    awayScore: number,
    competition: string = 'Другое',
  ): Promise<boolean> => {
    // Проверки
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      console.error('Команды не могут быть пустыми');
      return false;
    }

    // Проверяем, что игроки команд существуют
    const homePlayersExist = homeTeam.playerIds.every(id => 
      players.some(p => p.id === id)
    );
    const awayPlayersExist = awayTeam.playerIds.every(id => 
      players.some(p => p.id === id)
    );

    if (!homePlayersExist || !awayPlayersExist) {
      console.error('Не все игроки команд найдены');
      return false;
    }

    // Проверяем, что команды не пересекаются
    const hasCommonPlayers = homeTeam.playerIds.some(id => 
      awayTeam.playerIds.includes(id)
    );
    if (hasCommonPlayers) {
      console.error('Команды не могут содержать одинаковых игроков');
      return false;
    }

    // Вычисляем изменения рейтинга
    const ratingChanges = calculateTeamRatingChanges(homeTeam, awayTeam, homeScore, awayScore);

    // Определяем результат для каждой команды
    let homeResult: MatchResult;
    let awayResult: MatchResult;

    if (homeScore > awayScore) {
      homeResult = MatchResult.WIN;
      awayResult = MatchResult.LOSS;
    } else if (awayScore > homeScore) {
      homeResult = MatchResult.LOSS;
      awayResult = MatchResult.WIN;
    } else {
      homeResult = MatchResult.DRAW;
      awayResult = MatchResult.DRAW;
    }

    // Обновляем статистику игроков
    homeTeam.playerIds.forEach(playerId => {
      updatePlayerStats(playerId, homeScore, awayScore, homeResult);
    });
    awayTeam.playerIds.forEach(playerId => {
      updatePlayerStats(playerId, awayScore, homeScore, awayResult);
    });

    // Обновляем рейтинги игроков
    setPlayers(prevPlayers => {
      return prevPlayers.map(player => {
        const ratingChange = ratingChanges[player.id];
        if (ratingChange !== undefined) {
          return {
            ...player,
            rating: player.rating + ratingChange,
            lastRatingChange: ratingChange,
          };
        }
        return player;
      });
    });

    // Создаем матч
    const newMatch: Match = {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 10000)}`,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      date: new Date(),
      competition,
      ratingChanges,
      seasonId: currentSeason?.id || 'default',
    };

    setMatches(prev => [...prev, newMatch]);
    return true;
  };

  const removeMatch = async (matchId: string): Promise<void> => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Удаляем матч
    setMatches(prev => prev.filter(m => m.id !== matchId));

    // Пересчитываем все рейтинги заново
    // Это простая реализация - в реальном приложении можно было бы хранить историю
    resetAllPlayerStats();
  };

  const editMatch = async (
    matchId: string,
    newHomeTeam: Team,
    newAwayTeam: Team,
    newHomeScore: number,
    newAwayScore: number,
    newCompetition?: string
  ): Promise<boolean> => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return false;

    // Проверяем валидность команд
    if (newHomeTeam.playerIds.length === 0 || newAwayTeam.playerIds.length === 0) {
      console.error('Команды не могут быть пустыми');
      return false;
    }

    // Проверяем, что игроки существуют
    const allPlayerIds = [...newHomeTeam.playerIds, ...newAwayTeam.playerIds];
    const existingPlayers = players.filter(p => allPlayerIds.includes(p.id));
    if (existingPlayers.length !== allPlayerIds.length) {
      console.error('Некоторые игроки не найдены');
      return false;
    }

    // Проверяем валидность счета
    if (newHomeScore < 0 || newAwayScore < 0) {
      console.error('Счет не может быть отрицательным');
      return false;
    }

    // Удаляем старый матч и добавляем новый
    setMatches(prev => {
      const filteredMatches = prev.filter(m => m.id !== matchId);
      const newMatch: Match = {
        id: matchId, // Сохраняем тот же ID
        homeTeam: newHomeTeam,
        awayTeam: newAwayTeam,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        date: match.date, // Сохраняем дату
        competition: newCompetition || match.competition,
        ratingChanges: {}
      };
      return [...filteredMatches, newMatch];
    });

    // Пересчитываем все рейтинги заново
    resetAllPlayerStats();
    return true;
  };

  const resetAllPlayerStats = () => {
    setPlayers(prevPlayers =>
      prevPlayers.map(player => ({
        ...player,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        rating: 1500, // Сброс рейтинга до начального
        lastRatingChange: 0,
      })),
    );
    // После сброса статистики, пересчитываем все матчи
    const allMatches = [...matches];
    setMatches([]); // Очищаем матчи, чтобы добавить их заново
    allMatches.forEach(match =>
      addMatch(
        match.homeTeam,
        match.awayTeam,
        match.homeScore,
        match.awayScore,
        match.competition,
      ),
    );
  };

  const getPlayerRanking = (): Player[] => {
    return [...players].sort((a, b) => b.rating - a.rating);
  };

  const getPlayerMatches = (playerName: string): Match[] => {
    return matches.filter(
      match => 
        match.homeTeam.playerIds.some(id => 
          players.find(p => p.id === id)?.name === playerName
        ) ||
        match.awayTeam.playerIds.some(id => 
          players.find(p => p.id === id)?.name === playerName
        ),
    );
  };

  const getRecentMatches = (limit: number = 5): Match[] => {
    return getAllSeasonMatches().slice(0, limit);
  };

  const getTotalPlayers = (): number => {
    return players.length;
  };

  const getTotalMatches = (): number => {
    return matches.length;
  };

  const getAverageRating = (): number => {
    if (players.length === 0) return 0;
    const totalRating = players.reduce((sum, player) => sum + player.rating, 0);
    return Math.round(totalRating / players.length);
  };

  const addPredefinedPlayers = async (): Promise<void> => {
    console.log('addPredefinedPlayers: starting');
    
    const predefinedNames = [
      'Алексей', 'Дмитрий', 'Сергей', 'Андрей', 'Владимир',
      'Иван', 'Михаил', 'Николай', 'Александр', 'Евгений',
      'Максим', 'Артем', 'Игорь', 'Олег', 'Роман',
      'Павел', 'Антон', 'Денис', 'Кирилл', 'Станислав'
    ];

    console.log('addPredefinedPlayers: predefinedNames =', predefinedNames);

    for (let i = 0; i < predefinedNames.length; i++) {
      const name = predefinedNames[i];
      const rating = Math.floor(Math.random() * 1001) + 1000; // 1000-2000
      
      console.log(`addPredefinedPlayers: adding player ${i + 1}: ${name} with rating ${rating}`);
      
      // Добавляем небольшую задержку для уникальности ID
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const newPlayer: Player = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 10000)}`,
        name,
        rating,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        dateCreated: new Date(),
        lastRatingChange: 0,
      };

      console.log('addPredefinedPlayers: newPlayer =', newPlayer);
      setPlayers(prev => {
        console.log('addPredefinedPlayers: prev players =', prev);
        const newPlayers = [...prev, newPlayer];
        console.log('addPredefinedPlayers: new players =', newPlayers);
        return newPlayers;
      });
    }
    
    console.log('addPredefinedPlayers: finished');
  };

  const reloadData = async () => {
    console.log('RatingProvider: reloadData called');
    if (currentUser) {
      await loadData();
    }
  };

  const value: RatingContextType = {
    players,
    matches,
    seasons,
    currentSeason,
    addPlayer,
    removePlayer,
    editPlayer,
    addMatch,
    removeMatch,
    editMatch,
    getPlayerRanking,
    getPlayerMatches,
    getRecentMatches,
    getTotalPlayers,
    getTotalMatches,
    getAverageRating,
    addPredefinedPlayers,
    startNewSeason,
    getCurrentSeasonStats,
    getSeasonMatches,
    getAllSeasonMatches,
    reloadData,
  };

  return (
    <RatingContext.Provider value={value}>
      {children}
    </RatingContext.Provider>
  );
};

export const useRating = (): RatingContextType => {
  const context = useContext(RatingContext);
  if (context === undefined) {
    throw new Error('useRating must be used within a RatingProvider');
  }
  return context;
};