import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Player, Match, MatchResult, RatingContextType, Team, Season} from '../types';
import {useAuth} from './AuthContext';

// Объявляем глобальный объект window для TypeScript
declare global {
  var window: any;
}

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
    console.log('RatingProvider: useEffect triggered, currentUser:', currentUser);
    if (currentUser) {
      console.log('RatingProvider: useEffect loadData for user:', currentUser.username);
      console.log('RatingProvider: currentUser.id:', currentUser.id);
      // Добавляем задержку для веб-версии
      setTimeout(() => {
        console.log('RatingProvider: delayed loadData call');
        loadData();
      }, 2000); // Увеличиваем задержку до 2 секунд
    } else {
      console.log('RatingProvider: currentUser is null, clearing data');
      setPlayers([]);
      setMatches([]);
      setSeasons([]);
      setCurrentSeason(null);
      setSeasonMatches({});
    }
  }, [currentUser]);

  // Дополнительный useEffect для принудительной загрузки данных
  useEffect(() => {
    if (currentUser && players.length === 0) {
      console.log('RatingProvider: forcing loadData for user:', currentUser.username);
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    if (!currentUser) {
      console.log('RatingProvider: loadData skipped - no currentUser');
      return;
    }
    
    try {
      console.log('RatingProvider: loadData started for user:', currentUser.id);
      const keys = getStorageKeys(currentUser.id);
      console.log('RatingProvider: storage keys:', keys);
      
      // Проверим, есть ли вообще данные в AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('RatingProvider: all AsyncStorage keys:', allKeys);
      
      // Проверим конкретно ключи для нашего пользователя
      const userKeys = allKeys.filter((key: string) => key.includes(currentUser.id));
      console.log('RatingProvider: user-specific keys:', userKeys);
      
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
            
            // Дополнительная проверка - попробуем загрузить данные напрямую
            const directPlayersData = await AsyncStorage.getItem(keys.PLAYERS);
            console.log('RatingProvider: direct playersData =', directPlayersData);
            
            // Проверяем оба хранилища и выбираем более свежие данные
            let useLocalStorage = false;
            let useAsyncStorage = false;
            
            // Проверяем localStorage (веб-версия)
            if (typeof window !== 'undefined' && window.localStorage) {
              const localStoragePlayers = window.localStorage.getItem(keys.PLAYERS);
              if (localStoragePlayers && localStoragePlayers !== '[]' && localStoragePlayers !== 'null') {
                useLocalStorage = true;
                console.log('RatingProvider: localStorage has data');
              }
            }
            
            // Проверяем AsyncStorage (мобильная версия)
            if (playersData && playersData !== '[]' && playersData !== 'null') {
              useAsyncStorage = true;
              console.log('RatingProvider: AsyncStorage has data');
            }
            
            // Если есть данные в localStorage, используем их (веб-версия)
            if (useLocalStorage && typeof window !== 'undefined' && window.localStorage) {
              console.log('RatingProvider: using localStorage data (web version)');
              const localStoragePlayers = window.localStorage.getItem(keys.PLAYERS);
              const localStorageMatches = window.localStorage.getItem(keys.MATCHES);
              const localStorageSeasons = window.localStorage.getItem(keys.SEASONS);
              const localStorageCurrentSeason = window.localStorage.getItem(keys.CURRENT_SEASON);
              const localStorageSeasonMatches = window.localStorage.getItem(keys.SEASON_MATCHES);
              
              if (localStoragePlayers) setPlayers(JSON.parse(localStoragePlayers));
              if (localStorageMatches) setMatches(JSON.parse(localStorageMatches));
              if (localStorageSeasons) setSeasons(JSON.parse(localStorageSeasons));
              if (localStorageCurrentSeason) setCurrentSeason(JSON.parse(localStorageCurrentSeason));
              if (localStorageSeasonMatches) setSeasonMatches(JSON.parse(localStorageSeasonMatches));
              
              console.log('RatingProvider: localStorage data loaded');
              return;
            }
            
            // Если есть данные в AsyncStorage, используем их (мобильная версия)
            if (useAsyncStorage) {
              console.log('RatingProvider: using AsyncStorage data (mobile version)');
              if (playersData) setPlayers(JSON.parse(playersData));
              if (matchesData) setMatches(JSON.parse(matchesData));
              if (seasonsData) setSeasons(JSON.parse(seasonsData));
              if (currentSeasonData) setCurrentSeason(JSON.parse(currentSeasonData));
              if (seasonMatchesData) setSeasonMatches(JSON.parse(seasonMatchesData));
              
              console.log('RatingProvider: AsyncStorage data loaded');
              return;
            }
            
            // Проверим, что происходит с AsyncStorage в веб-версии
            console.log('RatingProvider: checking AsyncStorage directly...');
            try {
              const testData = await AsyncStorage.getItem('test_key');
              console.log('RatingProvider: test data =', testData);
              
              // Попробуем сохранить и сразу загрузить тестовые данные
              await AsyncStorage.setItem('test_key', 'test_value');
              const testDataAfterSave = await AsyncStorage.getItem('test_key');
              console.log('RatingProvider: test data after save =', testDataAfterSave);
              
              // Теперь попробуем загрузить данные игроков еще раз
              const playersDataRetry = await AsyncStorage.getItem(keys.PLAYERS);
              console.log('RatingProvider: playersData retry =', playersDataRetry);
            } catch (error) {
              console.error('RatingProvider: AsyncStorage test error:', error);
            }

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

  // Сохранение данных при изменении (только если данные уже загружены)
  useEffect(() => {
    if (currentUser && players.length > 0) {
      console.log('RatingProvider: auto-saving data, players:', players);
      saveData();
    }
  }, [players, matches, seasons, currentSeason, seasonMatches]);

  const saveData = async () => {
    if (!currentUser) return;
    
    try {
      const storageKeys = getStorageKeys(currentUser.id);
      
      // Всегда сохраняем в оба хранилища для синхронизации
      const playersData = JSON.stringify(players);
      const matchesData = JSON.stringify(matches);
      const seasonsData = JSON.stringify(seasons);
      const seasonMatchesData = JSON.stringify(seasonMatches);
      const currentSeasonData = currentSeason ? JSON.stringify(currentSeason) : null;
      
      // Сохраняем в AsyncStorage (для мобильной версии)
      await AsyncStorage.setItem(storageKeys.PLAYERS, playersData);
      await AsyncStorage.setItem(storageKeys.MATCHES, matchesData);
      await AsyncStorage.setItem(storageKeys.SEASONS, seasonsData);
      await AsyncStorage.setItem(storageKeys.SEASON_MATCHES, seasonMatchesData);
      if (currentSeasonData) {
        await AsyncStorage.setItem(storageKeys.CURRENT_SEASON, currentSeasonData);
      }
      
      // Также сохраняем в localStorage (для веб-версии)
      if (typeof window !== 'undefined' && window.localStorage) {
        console.log('RatingProvider: saving to both localStorage and AsyncStorage');
        window.localStorage.setItem(storageKeys.PLAYERS, playersData);
        window.localStorage.setItem(storageKeys.MATCHES, matchesData);
        window.localStorage.setItem(storageKeys.SEASONS, seasonsData);
        window.localStorage.setItem(storageKeys.SEASON_MATCHES, seasonMatchesData);
        if (currentSeasonData) {
          window.localStorage.setItem(storageKeys.CURRENT_SEASON, currentSeasonData);
        }
        console.log('RatingProvider: localStorage save completed');
      }
      
      console.log('RatingProvider: data saved to both storages');
    } catch (error) {
      console.error('Ошибка сохранения данных:', error);
    }
  };

  const updatePlayerStats = (
    playerId: string,
    score: number,
    opponentScore: number,
    result: MatchResult,
    homeTeam: Team,
    awayTeam: Team,
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

          // Рассчитываем изменение рейтинга
          const ratingChange = calculateRatingChange(
            player,
            homeTeam,
            awayTeam,
            score,
            opponentScore,
            result
          );

          return {
            ...player,
            matchesPlayed: player.matchesPlayed + 1,
            wins,
            draws,
            losses,
            goalsScored: player.goalsScored + score,
            goalsConceded: player.goalsConceded + opponentScore,
            rating: player.rating + ratingChange,
            lastRatingChange: ratingChange,
          };
        }
        return player;
      }),
    );
  };

  const calculateRatingChange = (
    player: Player,
    homeTeam: Team,
    awayTeam: Team,
    score: number,
    opponentScore: number,
    result: MatchResult,
  ): number => {
    const sumA = homeTeam.totalRating;
    const sumB = awayTeam.totalRating;
    
    let adjustedScoreA = score;
    let adjustedScoreB = opponentScore;
    if (adjustedScoreA === 0 && adjustedScoreB === 0) {
      adjustedScoreA = 1;
      adjustedScoreB = 1;
    }
    
    const isPlayerInTeamA = homeTeam.playerIds.includes(player.id);
    const isTeamAWinner = adjustedScoreA > adjustedScoreB;
    const isDraw = adjustedScoreA === adjustedScoreB;
    
    // RD = разница в рейтингах между командой А и командой Б (не победитель-проигравший)
    const RD = sumA - sumB;
    const totalPlayers = homeTeam.playerIds.length + awayTeam.playerIds.length;
    const ES = (RD / (totalPlayers / 2)) / 200 * 6;
    
    // goalDiff = фактически забитые голы командой А минус голы команды В
    const goalDiff = adjustedScoreA - adjustedScoreB;
    const goalRatio = adjustedScoreB / adjustedScoreA;
    const RGD = goalDiff * ((0.8 - goalRatio) + 1);
    const GV = 7 * ((12 - totalPlayers) / 10 + 1);
    const TV = (totalPlayers / 2) * GV * (RGD - ES);
    
    // Определяем команды для расчета
    const winnerIds = isTeamAWinner ? homeTeam.playerIds : awayTeam.playerIds;
    const loserIds = isTeamAWinner ? awayTeam.playerIds : homeTeam.playerIds;
    const winnerTotalRating = isTeamAWinner ? sumA : sumB;
    const loserTotalRating = isTeamAWinner ? sumB : sumA;
    
    let playerRatingChange = 0;
    
    if (isPlayerInTeamA) {
      // Игрок в команде A
      if (isTeamAWinner) {
        // Команда A выиграла - получает бонус пропорционально рейтингу
        const playerShare = player.rating / winnerTotalRating;
        playerRatingChange = Math.round(TV * playerShare);
      } else if (isDraw) {
        // Ничья - команда с более низким рейтингом получает бонус
        if (sumA < sumB) {
          const playerShare = player.rating / sumA;
          playerRatingChange = Math.round(TV * playerShare * 0.5);
        } else {
          const playerShare = player.rating / sumA;
          playerRatingChange = Math.round(-TV * playerShare * 0.3);
        }
      } else {
        // Команда A проиграла - получает штраф пропорционально рейтингу
        const playerShare = player.rating / loserTotalRating;
        playerRatingChange = Math.round(-TV * playerShare);
      }
    } else {
      // Игрок в команде B
      if (!isTeamAWinner && !isDraw) {
        // Команда B выиграла - получает бонус пропорционально рейтингу
        const playerShare = player.rating / winnerTotalRating;
        playerRatingChange = Math.round(TV * playerShare);
      } else if (isDraw) {
        // Ничья - команда с более низким рейтингом получает бонус
        if (sumB < sumA) {
          const playerShare = player.rating / sumB;
          playerRatingChange = Math.round(TV * playerShare * 0.5);
        } else {
          const playerShare = player.rating / sumB;
          playerRatingChange = Math.round(-TV * playerShare * 0.3);
        }
      } else {
        // Команда B проиграла - получает штраф пропорционально рейтингу
        const playerShare = player.rating / loserTotalRating;
        playerRatingChange = Math.round(-TV * playerShare);
      }
    }
    
    console.log(`Rating calculation for ${player.name}:`, {
      isPlayerInTeamA,
      isTeamAWinner,
      isDraw,
      RD,
      ES,
      goalDiff,
      RGD,
      GV,
      TV,
      sumA,
      sumB,
      score: adjustedScoreA,
      opponentScore: adjustedScoreB,
      playerRatingChange
    });
    
    return playerRatingChange;
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

    console.log('RatingContext: calculateAllPlayerRatingChanges:', {
      sumA,
      sumB,
      winnerSum,
      loserSum,
      RD,
      ES,
      goalDiff,
      RGD,
      GV,
      TV,
      winnerIds,
      loserIds,
      changes
    });

    return changes;
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
      seasonStartRating: initialRating, // Рейтинг на начало сезона равен начальному рейтингу
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

  const updatePlayer = async (id: string, name: string, rating: number): Promise<boolean> => {
    const trimmedName = name.trim();
    if (players.some(player => player.id !== id && player.name.toLowerCase() === trimmedName.toLowerCase())) {
      return false; // Игрок с таким именем уже существует
    }

    if (rating < 1000 || rating > 2000) {
      console.error('Рейтинг должен быть от 1000 до 2000');
      return false;
    }

    setPlayers(prevPlayers =>
      prevPlayers.map(player =>
        player.id === id ? {...player, name: trimmedName, rating} : player,
      ),
    );
    return true;
  };

  const deletePlayer = async (id: string): Promise<void> => {
    setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== id));
  };

  const addMatch = async (
    homeTeam: Team,
    awayTeam: Team,
    homeScore: number,
    awayScore: number,
    competition?: string,
  ): Promise<boolean> => {
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      console.error('Команды не могут быть пустыми');
      return false;
    }

    if (homeScore < 0 || awayScore < 0) {
      console.error('Счет не может быть отрицательным');
      return false;
    }

    const match: Match = {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      date: new Date(),
      competition: competition || 'Товарищеский матч',
      ratingChanges: {},
      seasonId: currentSeason?.id || '',
    };

    setMatches(prevMatches => [...prevMatches, match]);

    // Рассчитываем изменения рейтинга для всех игроков
    const ratingChanges = calculateAllPlayerRatingChanges(homeTeam, awayTeam, homeScore, awayScore);
    
    // Обновляем статистику всех игроков разом
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
            lastRatingChange: change, // Обновляем только для игроков, участвовавших в матче
          };
        }
        // Для игроков, не участвовавших в матче, сбрасываем lastRatingChange в 0
        return {
          ...player,
          lastRatingChange: 0,
        };
      })
    );

    return true;
  };

  const deleteMatch = async (id: string): Promise<boolean> => {
    setMatches(prevMatches => prevMatches.filter(match => match.id !== id));
    return true;
  };

  const addSeason = async (name: string, startDate: string, endDate: string): Promise<boolean> => {
    const trimmedName = name.trim();
    if (seasons.some(season => season.name.toLowerCase() === trimmedName.toLowerCase())) {
      return false; // Сезон с таким именем уже существует
    }

    const newSeason: Season = {
      id: `season_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      number: seasons.length + 1,
      name: trimmedName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: false,
      totalMatches: 0,
      averageRating: 0,
    };

    setSeasons(prevSeasons => [...prevSeasons, newSeason]);
    return true;
  };

  const updateSeason = async (id: string, name: string, startDate: string, endDate: string): Promise<boolean> => {
    const trimmedName = name.trim();
    if (seasons.some(season => season.id !== id && season.name.toLowerCase() === trimmedName.toLowerCase())) {
      return false; // Сезон с таким именем уже существует
    }

    setSeasons(prevSeasons =>
      prevSeasons.map(season =>
        season.id === id ? {...season, name: trimmedName, startDate: new Date(startDate), endDate: new Date(endDate)} : season,
      ),
    );
    return true;
  };

  const deleteSeason = async (id: string): Promise<boolean> => {
    setSeasons(prevSeasons => prevSeasons.filter(season => season.id !== id));
    return true;
  };

  const setCurrentSeasonById = async (id: string): Promise<boolean> => {
    const season = seasons.find(s => s.id === id);
    if (!season) return false;

    setCurrentSeason(season);
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

  const addMatchToSeason = async (matchId: string, seasonId: string): Promise<boolean> => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return false;

    setSeasonMatches(prevSeasonMatches => ({
      ...prevSeasonMatches,
      [seasonId]: [...(prevSeasonMatches[seasonId] || []), match],
    }));
    return true;
  };

  const removeMatchFromSeason = async (matchId: string, seasonId: string): Promise<boolean> => {
    setSeasonMatches(prevSeasonMatches => ({
      ...prevSeasonMatches,
      [seasonId]: (prevSeasonMatches[seasonId] || []).filter(match => match.id !== matchId),
    }));
    return true;
  };

  const reloadData = async () => {
    console.log('RatingProvider: reloadData called');
    if (currentUser) {
      await loadData();
    }
  };


  const startNewSeason = async (): Promise<boolean> => {
    console.log('RatingContext: startNewSeason called');
    try {
      console.log('RatingContext: Resetting player stats...');
      console.log('RatingContext: Players before reset:', players);

      // Обнуляем только статистику матчей, рейтинги сохраняем
      setPlayers(prevPlayers => {
        const updatedPlayers = prevPlayers.map(player => ({
          ...player,
          // rating остается прежним - НЕ изменяем
          seasonStartRating: player.rating, // Устанавливаем рейтинг на начало сезона
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        lastRatingChange: 0,
        }));
        console.log('RatingContext: Players after reset:', updatedPlayers);
        return updatedPlayers;
      });

      console.log('RatingContext: Clearing matches...');
      // Очищаем все матчи
      setMatches([]);

      console.log('RatingContext: Clearing season matches...');
      // Очищаем матчи сезонов
      setSeasonMatches({});

      console.log('RatingContext: Creating new season...');
      // Создаем новый сезон
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

      console.log('RatingContext: Новый сезон создан:', newSeason);
      return true;
    } catch (error) {
      console.error('RatingContext: Ошибка при создании нового сезона:', error);
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
    deleteMatch: deleteMatch,
    addSeason,
    updateSeason,
    deleteSeason,
    setCurrentSeasonById,
    getTotalMatches,
    getAverageRating,
    getPlayersByRating,
    getMatchesByDate,
    getSeasonMatches,
    addMatchToSeason,
    removeMatchFromSeason,
    reloadData,
    startNewSeason,
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
