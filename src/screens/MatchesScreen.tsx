import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRating} from '../context/RatingContext';
import {useLanguage} from '../context/LanguageContext';
import {useSport} from '../context/SportContext';
import {useAuth} from '../context/AuthContext';
import {Player, Team} from '../types';


const MatchesScreen: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentSport } = useSport();
  const { currentUser } = useAuth();
  const {players, matches: matchesRaw, addMatch, editMatch, removeMatch, deleteMatch, getRecentMatches} = useRating();
  
  // Проверяем, является ли пользователь админом
  const isAdmin = currentUser?.role === 'admin';
  
  // Защита от undefined
  const matches = matchesRaw || [];
  const safePlayers = players || [];
  const [homeTeam, setHomeTeam] = useState<Team>({id: 'home', name: 'Команда A', playerIds: [], totalRating: 0});
  const [awayTeam, setAwayTeam] = useState<Team>({id: 'away', name: 'Команда B', playerIds: [], totalRating: 0});
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [competition, setCompetition] = useState<string>('Матч');
  const [isSavingMatch, setIsSavingMatch] = useState<boolean>(false);
  const isSavingMatchRef = useRef<boolean>(false);
  
  // Состояние для отмены матча
  const [isLastMatchCancelled, setIsLastMatchCancelled] = useState<boolean>(false);

  // Функции для работы с хранилищем
  const saveCancelState = async (cancelled: boolean) => {
    try {
      await AsyncStorage.setItem('isLastMatchCancelled', cancelled.toString());
    } catch (error) {
      console.error('Ошибка сохранения состояния отмены:', error);
    }
  };

  const loadCancelState = async () => {
    try {
      const saved = await AsyncStorage.getItem('isLastMatchCancelled');
      if (saved !== null) {
        setIsLastMatchCancelled(saved === 'true');
      }
    } catch (error) {
      console.error('Ошибка загрузки состояния отмены:', error);
    }
  };
  
  // Состояние для отображения параметров расчета (для тестирования)
  const [showCalculationParams, setShowCalculationParams] = useState<boolean>(false);

  // Локализация слова "игрок(ов)/players" по количеству
  const getPlayersWord = (count: number): string => {
    if (language === 'ru') {
      const mod10 = count % 10;
      const mod100 = count % 100;
      if (mod10 === 1 && mod100 !== 11) return 'игрок';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'игрока';
      return 'игроков';
    }
    // en
    return count === 1 ? 'player' : 'players';
  };
  
  // Загружаем состояние отмены при монтировании
  useEffect(() => {
    loadCancelState();
  }, []);

  // Сбрасываем состояние отмены, если нет матчей
  useEffect(() => {
    if (matches.length === 0 && isLastMatchCancelled) {
      setIsLastMatchCancelled(false);
      saveCancelState(false);
    }
  }, [matches.length, isLastMatchCancelled]);

  // Обновляем totalRating команд при изменении players
  useEffect(() => {
    // Проверяем что players загружены
    if (!safePlayers || safePlayers.length === 0) return;
    
    const updateTeamRating = (team: Team) => {
      const newTotalRating = team.playerIds.reduce((sum, id) => {
        const p = safePlayers.find(pl => pl.id === id);
        return sum + (p?.rating || 0);
      }, 0);
      return { ...team, totalRating: newTotalRating };
    };

    if (homeTeam.playerIds.length > 0) {
      setHomeTeam(updateTeamRating(homeTeam));
    }
    if (awayTeam.playerIds.length > 0) {
      setAwayTeam(updateTeamRating(awayTeam));
    }
  }, [players, safePlayers.length]);
  
  // Функция для расчета изменений рейтинга игроков
  const calculatePlayerRatingChanges = () => {
    // Проверка что игроки загружены
    if (!safePlayers || safePlayers.length === 0) {
      return {};
    }
    
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      return {};
    }
    
    const sumA = homeTeam.totalRating;
    const sumB = awayTeam.totalRating;
    
    let adjustedScoreA = parseInt(homeScore) || 0;
    let adjustedScoreB = parseInt(awayScore) || 0;
    if (adjustedScoreA === 0 && adjustedScoreB === 0) {
      adjustedScoreA = 1;
      adjustedScoreB = 1;
    }
    
    const isTeamAWinner = adjustedScoreA >= adjustedScoreB;
    const winnerSum = isTeamAWinner ? sumA : sumB;
    const loserSum = isTeamAWinner ? sumB : sumA;
    const winnerScore = isTeamAWinner ? adjustedScoreA : adjustedScoreB;
    const loserScore = isTeamAWinner ? adjustedScoreB : adjustedScoreA;
    const winnerIds = isTeamAWinner ? homeTeam.playerIds : awayTeam.playerIds;
    const loserIds = isTeamAWinner ? awayTeam.playerIds : homeTeam.playerIds;
    
    // ✅ ОРИГИНАЛЬНАЯ ФОРМУЛА из AppStore версии (адаптирована для баскетбола)
    const totalPlayers = homeTeam.playerIds.length + awayTeam.playerIds.length;
    
    // Для баскетбола используем разницу средних рейтингов команды A относительно команды B, для футбола - общих
    // ES должен быть положительным, если команда A сильнее, и отрицательным, если команда A слабее
    const RD = currentSport === 'basketball'
      ? (sumA / homeTeam.playerIds.length) - (sumB / awayTeam.playerIds.length)  // Баскетбол: средние рейтинги команды A минус команды B
      : sumA - sumB;  // Футбол: общие рейтинги команды A минус команды B
    
    // Разные формулы ES для разных спортов
    const ES = currentSport === 'basketball'
      ? RD / 10  // Баскетбол: упрощённая формула
      : (RD / (totalPlayers / 2)) / 200 * 6;  // Футбол: оригинальная формула
    
    // RGD рассчитывается как разница между командой A и командой B (не winner/loser)
    // RGD должна быть положительной, если команда A выиграла, и отрицательной, если проиграла
    const goalDiff = adjustedScoreA - adjustedScoreB;
    // goalRatio всегда должен быть меньше 1: меньший счет делим на больший
    const minScore = Math.min(adjustedScoreA, adjustedScoreB);
    const maxScore = Math.max(adjustedScoreA, adjustedScoreB);
    const goalRatio = maxScore > 0 ? minScore / maxScore : 0;
    const RGD = goalDiff * ((0.8 - goalRatio) + 1);
    
    // Разные формулы GV для разных спортов
    const GV = currentSport === 'basketball'
      ? 3 * ((10 - totalPlayers) / 10 + 1)  // Баскетбол: меньший коэффициент, оптимум 10 игроков
      : 7 * ((12 - totalPlayers) / 10 + 1); // Футбол: оригинальная формула
    
    const TV = (totalPlayers / 2) * GV * (RGD - ES);
    
    // Рассчитываем изменения рейтингов для каждого игрока
    // Неважно кто выиграл: знак зависит от TV
    // Если TV положительный → команда A получает плюс, команда B получает минус
    // Если TV отрицательный → команда A получает минус, команда B получает плюс
    const changes: {[playerId: string]: number} = {};
    
    // Для игроков команды A
    const teamATotalRating = homeTeam.playerIds.reduce((acc, id) => acc + (safePlayers.find(p => p.id === id)?.rating || 0), 0);
    homeTeam.playerIds.forEach(id => {
      const player = safePlayers.find(p => p.id === id);
      if (player) {
        const playerShare = player.rating / teamATotalRating;
        const change = Math.round(TV * playerShare);
        changes[id] = change;
      }
    });
    
    // Для игроков команды B
    const teamBTotalRating = awayTeam.playerIds.reduce((acc, id) => acc + (safePlayers.find(p => p.id === id)?.rating || 0), 0);
    awayTeam.playerIds.forEach(id => {
      const player = safePlayers.find(p => p.id === id);
      if (player) {
        const playerShare = player.rating / teamBTotalRating;
        const change = Math.round(-TV * playerShare);
        changes[id] = change;
      }
    });
    
    console.log('MatchesScreen: calculatePlayerRatingChanges:', {
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

  // Функция для расчета параметров (для отображения)
  const calculateParams = () => {
    const changes = calculatePlayerRatingChanges();
    if (Object.keys(changes).length === 0) {
      return null;
    }
    
    const sumA = homeTeam.totalRating;
    const sumB = awayTeam.totalRating;
    
    let adjustedScoreA = parseInt(homeScore) || 0;
    let adjustedScoreB = parseInt(awayScore) || 0;
    if (adjustedScoreA === 0 && adjustedScoreB === 0) {
      adjustedScoreA = 1;
      adjustedScoreB = 1;
    }
    
    const isTeamAWinner = adjustedScoreA >= adjustedScoreB;
    const winnerSum = isTeamAWinner ? sumA : sumB;
    const loserSum = isTeamAWinner ? sumB : sumA;
    const winnerScore = isTeamAWinner ? adjustedScoreA : adjustedScoreB;
    const loserScore = isTeamAWinner ? adjustedScoreB : adjustedScoreA;
    
    // ✅ ОРИГИНАЛЬНАЯ ФОРМУЛА из AppStore версии (адаптирована для баскетбола)
    const totalPlayers = homeTeam.playerIds.length + awayTeam.playerIds.length;
    
    // Для баскетбола используем разницу средних рейтингов команды A относительно команды B, для футбола - общих
    // ES должен быть положительным, если команда A сильнее, и отрицательным, если команда A слабее
    const RD = currentSport === 'basketball'
      ? (sumA / homeTeam.playerIds.length) - (sumB / awayTeam.playerIds.length)  // Баскетбол: средние рейтинги команды A минус команды B
      : sumA - sumB;  // Футбол: общие рейтинги команды A минус команды B
    
    // Разные формулы ES для разных спортов
    const ES = currentSport === 'basketball'
      ? RD / 10  // Баскетбол: упрощённая формула
      : (RD / (totalPlayers / 2)) / 200 * 6;  // Футбол: оригинальная формула
    
    // RGD рассчитывается как разница между командой A и командой B (не winner/loser)
    // RGD должна быть положительной, если команда A выиграла, и отрицательной, если проиграла
    const goalDiff = adjustedScoreA - adjustedScoreB;
    // goalRatio всегда должен быть меньше 1: меньший счет делим на больший
    const minScore = Math.min(adjustedScoreA, adjustedScoreB);
    const maxScore = Math.max(adjustedScoreA, adjustedScoreB);
    const goalRatio = maxScore > 0 ? minScore / maxScore : 0;
    const RGD = goalDiff * ((0.8 - goalRatio) + 1);
    
    // Разные формулы GV для разных спортов
    const GV = currentSport === 'basketball'
      ? 3 * ((10 - totalPlayers) / 10 + 1)  // Баскетбол: меньший коэффициент, оптимум 10 игроков
      : 7 * ((12 - totalPlayers) / 10 + 1); // Футбол: оригинальная формула
    
    const TV = (totalPlayers / 2) * GV * (RGD - ES);
    
    return {
      RD,
      ES,
      RGD,
      GV,
      TV,
      adjustedScoreA,
      adjustedScoreB,
      isTeamAWinner,
      changes
    };
  };
  

  const updateTeamName = (teamType: 'home' | 'away', currentTeam?: Team) => {
    // Используем переданную команду или получаем текущую
    const team = currentTeam || (teamType === 'home' ? homeTeam : awayTeam);
    const teamPlayers = players
      .filter(player => team.playerIds.includes(player.id))
      .sort((a, b) => b.rating - a.rating);
    
    if (teamPlayers.length === 0) {
      const newName = teamType === 'home' ? 'Команда A' : 'Команда B';
      if (teamType === 'home') {
        setHomeTeam(prev => ({...prev, name: newName}));
      } else {
        setAwayTeam(prev => ({...prev, name: newName}));
      }
      return;
    }

    // Первый игрок в отсортированном списке - самый сильный
    const strongestPlayer = teamPlayers[0];
    const newName = `${strongestPlayer.name}`;
    
    if (teamType === 'home') {
      setHomeTeam(prev => ({...prev, name: newName}));
    } else {
      setAwayTeam(prev => ({...prev, name: newName}));
    }
  };

  const getTeamPlayers = (teamType: 'home' | 'away'): Player[] => {
    const team = teamType === 'home' ? homeTeam : awayTeam;
    return safePlayers
      .filter(player => team.playerIds.includes(player.id))
      .sort((a, b) => b.rating - a.rating); // Сортируем по убыванию рейтинга
  };

  const addPlayerToTeam = (playerId: string, teamType: 'home' | 'away') => {
    const team = teamType === 'home' ? homeTeam : awayTeam;
    
    // Проверяем, что игрок не в другой команде
    const otherTeam = teamType === 'home' ? awayTeam : homeTeam;
    if (otherTeam.playerIds.includes(playerId)) {
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Error', t('messages.player_already_in_other_team'));
      return;
    }
    
    // Проверяем, что игрок не в этой команде
    if (team.playerIds.includes(playerId)) {
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Error', t('messages.player_already_in_team'));
      return;
    }

    const player = safePlayers.find(p => p.id === playerId);
    if (!player) return;

    const newPlayerIds = [...team.playerIds, playerId];
    const newTotalRating = newPlayerIds.reduce((sum, id) => {
      const p = safePlayers.find(pl => pl.id === id);
      return sum + (p?.rating || 0);
    }, 0);

    if (teamType === 'home') {
      const newTeam = {
        ...homeTeam,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      };
      setHomeTeam(newTeam);
      // Обновляем название команды с актуальными данными
      setTimeout(() => updateTeamName(teamType, newTeam), 100);
    } else {
      const newTeam = {
        ...awayTeam,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      };
      setAwayTeam(newTeam);
      // Обновляем название команды с актуальными данными
      setTimeout(() => updateTeamName(teamType, newTeam), 100);
    }
  };

  const removePlayerFromTeam = (playerId: string, teamType: 'home' | 'away') => {
    const team = teamType === 'home' ? homeTeam : awayTeam;
    const newPlayerIds = team.playerIds.filter(id => id !== playerId);
    const newTotalRating = newPlayerIds.reduce((sum, id) => {
      const p = safePlayers.find(pl => pl.id === id);
      return sum + (p?.rating || 0);
    }, 0);

    if (teamType === 'home') {
      const newTeam = {
        ...homeTeam,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      };
      setHomeTeam(newTeam);
      // Обновляем название команды с актуальными данными
      setTimeout(() => updateTeamName(teamType, newTeam), 100);
    } else {
      const newTeam = {
        ...awayTeam,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      };
      setAwayTeam(newTeam);
      // Обновляем название команды с актуальными данными
      setTimeout(() => updateTeamName(teamType, newTeam), 100);
    }
  };

  const handleSaveMatch = async () => {
    if (isSavingMatchRef.current) {
      console.log('⚠️ MatchesScreen: save match pressed while already saving, ignoring');
      return;
    }

    // Проверяем, является ли пользователь админом
    if (!isAdmin) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' ? 'Только администратор может создавать матчи' : 'Only admin can create matches'
      );
      return;
    }

    // Проверки команд
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error', 
        t('messages.team_must_have_players')
      );
      return;
    }

    // Проверка минимального количества игроков
    if (homeTeam.playerIds.length < 1 || awayTeam.playerIds.length < 1) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' 
          ? 'Каждая команда должна иметь хотя бы одного игрока'
          : 'Each team must have at least one player'
      );
      return;
    }

    // Валидация счёта
    const homeScoreNum = parseInt(homeScore) || 0;
    const awayScoreNum = parseInt(awayScore) || 0;

    if (homeScore === '' || awayScore === '') {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' ? 'Введите счёт для обеих команд' : 'Enter score for both teams'
      );
      return;
    }

    if (homeScoreNum < 0 || awayScoreNum < 0) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error', 
        language === 'ru' ? 'Счёт не может быть отрицательным' : 'Score cannot be negative'
      );
      return;
    }

    if (homeScoreNum > 999 || awayScoreNum > 999) {
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' ? 'Счёт слишком большой (максимум 999)' : 'Score too large (max 999)'
      );
      return;
    }

    // Добавляем новый матч
    console.log('🔄 MatchesScreen: Calling addMatch...');
    let success = false;
    try {
      setIsSavingMatch(true);
      isSavingMatchRef.current = true;
      success = await addMatch(homeTeam, awayTeam, homeScoreNum, awayScoreNum, competition);
      console.log('🔄 MatchesScreen: addMatch result:', success);
    } catch (error) {
      console.error('❌ MatchesScreen: addMatch threw an error:', error);
      success = false;
    } finally {
      setIsSavingMatch(false);
      isSavingMatchRef.current = false;
    }

    if (success) {
      console.log('✅ MatchesScreen: Match saved successfully, showing alert');
      // Сбрасываем флаг отмены при добавлении нового матча
      setIsLastMatchCancelled(false);
      await saveCancelState(false);
      // Web-уведомление (на RN-web Alert может не показываться)
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(t('messages.match_saved_success'));
      } else {
        Alert.alert(
          language === 'ru' ? 'Успех' : 'Success',
          t('messages.match_saved_success'),
          [{ text: language === 'ru' ? 'ОК' : 'OK', style: 'default' }]
        );
      }
      resetForm();
    } else {
      console.log('❌ MatchesScreen: Match save failed, showing error alert');
      // Показываем уведомление об ошибке
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        t('messages.match_save_error'),
        [{ text: language === 'ru' ? 'ОК' : 'OK', style: 'default' }]
      );
    }
  };

  const resetForm = () => {
    setHomeTeam({id: 'home', name: 'Команда A', playerIds: [], totalRating: 0});
    setAwayTeam({id: 'away', name: 'Команда B', playerIds: [], totalRating: 0});
    setHomeScore('0');
    setAwayScore('0');
    setCompetition('Матч');
  };


  const handleDeleteMatch = async (matchId: string) => {
    // Проверяем, не была ли уже отмена
    if (isLastMatchCancelled) {
      Alert.alert(
        t('messages.cancel_already_done'),
        t('messages.cancel_already_done_message'),
        [{text: t('common.ok'), style: 'default'}]
      );
      return;
    }

    Alert.alert(
      t('messages.cancel_last_match_title'),
      t('messages.cancel_last_match_confirm'),
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: t('matches.cancel_button'),
          style: 'destructive',
          onPress: async () => {
            const success = await deleteMatch(matchId);
            if (success) {
              setIsLastMatchCancelled(true);
              await saveCancelState(true);
              Alert.alert(t('messages.match_cancelled_success'));
            } else {
              Alert.alert(language === 'ru' ? 'Ошибка' : 'Error', t('messages.match_cancelled_error'));
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>⚽ {t('matches.add_match')}</Text>
        <TouchableOpacity 
          style={styles.toggleParamsButton}
          onPress={() => setShowCalculationParams(!showCalculationParams)}
        >
          <Text style={styles.toggleParamsText}>
            {showCalculationParams ? `📊 ${t('matches.hide_params')}` : `📊 ${t('matches.show_params')}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Параметры расчета (для тестирования) */}
      {showCalculationParams && (
        <View style={styles.calculationParams}>
          <Text style={styles.paramsTitle}>📊 {t('matches.calculation_params')}</Text>
          {(() => {
            const params = calculateParams();
            return params ? (
              <View style={styles.paramsList}>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>{t('matches.expected_difference')}</Text>
                  <Text style={styles.paramValue}>{params.ES.toFixed(2)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>{t('matches.real_difference')}</Text>
                  <Text style={styles.paramValue}>{params.RGD.toFixed(2)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>{t('matches.goal_value')}</Text>
                  <Text style={styles.paramValue}>{params.GV.toFixed(2)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>{t('matches.total_value')}</Text>
                  <Text style={styles.paramValue}>{Math.round(params.TV)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noParamsText}>
                {t('messages.add_players_for_params')}
              </Text>
            );
          })()}
        </View>
      )}

      {/* Выбор игроков для команд */}
      <View style={styles.swipeLayout}>
        {/* Заголовки команд */}
        <View style={styles.teamsHeader}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamTitle}>{homeTeam.name || t('matches.team_a')}</Text>
            <Text style={styles.teamStats}>
              {homeTeam.playerIds.length} {language === 'ru' ? 'игр.' : 'pl.'} • {
                currentSport === 'basketball' 
                  ? `Avg Rating: ${homeTeam.playerIds.length > 0 ? Math.round(homeTeam.totalRating / homeTeam.playerIds.length) : 0}`
                  : `${t('messages.rating_label')}: ${homeTeam.totalRating}`
              }
            </Text>
          </View>
          <View style={styles.teamHeader}>
            <Text style={styles.teamTitle}>{awayTeam.name || t('matches.team_b')}</Text>
            <Text style={styles.teamStats}>
              {awayTeam.playerIds.length} {language === 'ru' ? 'игр.' : 'pl.'} • {
                currentSport === 'basketball' 
                  ? `Avg Rating: ${awayTeam.playerIds.length > 0 ? Math.round(awayTeam.totalRating / awayTeam.playerIds.length) : 0}`
                  : `${t('messages.rating_label')}: ${awayTeam.totalRating}`
              }
            </Text>
          </View>
        </View>


        {/* Список доступных игроков */}
        <View style={styles.playersListContainer}>
          <Text style={styles.playersListTitle}>
            {t('messages.available_players')} ({safePlayers.filter(p => !homeTeam.playerIds.includes(p.id) && !awayTeam.playerIds.includes(p.id)).length})
          </Text>
          <ScrollView style={styles.playersList} showsVerticalScrollIndicator={true}>
            {safePlayers
              .sort((a, b) => b.rating - a.rating)
              .map((player, index) => {
                const isSelected = homeTeam.playerIds.includes(player.id) || awayTeam.playerIds.includes(player.id);
                return (
                  <View key={player.id} style={[styles.playerCard, isSelected && styles.playerCardDisabled]}>
                    <View style={styles.playerInfo}>
                      <Text style={[styles.playerNumber, isSelected && styles.textDisabled]} numberOfLines={1}>{index + 1}.</Text>
                      <Text style={[styles.playerName, isSelected && styles.textDisabled]} numberOfLines={1}>
                        {player.name.length > 12 ? player.name.substring(0, 12) + '...' : player.name}
                      </Text>
                      <Text style={[styles.playerRating, isSelected && styles.textDisabled]} numberOfLines={1}>{Math.round(player.rating)}</Text>
                    </View>
                    <View style={styles.playerActions}>
                      {isAdmin ? (
                        <>
                          <TouchableOpacity 
                            style={[styles.teamButton, styles.teamAButton, isSelected && styles.buttonDisabled]} 
                            onPress={() => addPlayerToTeam(player.id, 'home')}
                            disabled={isSelected}
                          >
                            <Text style={[styles.teamButtonText, isSelected && styles.textDisabled]}>A</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.teamButton, styles.teamBButton, isSelected && styles.buttonDisabled]} 
                            onPress={() => addPlayerToTeam(player.id, 'away')}
                            disabled={isSelected}
                          >
                            <Text style={[styles.teamButtonText, isSelected && styles.textDisabled]}>B</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <View style={[styles.teamButton, styles.teamAButton, styles.buttonDisabled]}>
                            <Text style={[styles.teamButtonText, styles.textDisabled]}>A</Text>
                          </View>
                          <View style={[styles.teamButton, styles.teamBButton, styles.buttonDisabled]}>
                            <Text style={[styles.teamButtonText, styles.textDisabled]}>B</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
          </ScrollView>
        </View>

        {/* Списки игроков в командах */}
        <View style={styles.teamsContainer}>
          <View style={styles.teamPlayersContainer}>
            <Text style={styles.teamPlayersTitle}>{homeTeam.name || t('matches.team_a')}</Text>
            <ScrollView style={styles.teamPlayersList} showsVerticalScrollIndicator={false}>
              {getTeamPlayers('home').map((player, index) => {
                const ratingChanges = calculatePlayerRatingChanges();
                const change = ratingChanges[player.id] || 0;
                const newRating = player.rating + change;
                
                return (
                  <View key={`home_${player.id}_${index}`} style={styles.teamPlayerCard}>
                    <View style={styles.teamPlayerInfo}>
                      <View style={styles.teamPlayerRow}>
                        <Text style={styles.teamPlayerNumber} numberOfLines={1}>{index + 1}.</Text>
                        <Text style={styles.teamPlayerName} numberOfLines={1}>
                          {player.name.length > 10 ? player.name.substring(0, 10) + '...' : player.name}
                        </Text>
                        <Text style={styles.teamPlayerRating} numberOfLines={1}>
                          {player.rating}
                        </Text>
                        <Text style={[
                          styles.teamPlayerChange,
                          change > 0 ? styles.positiveChange : change < 0 ? styles.negativeChange : styles.neutralChange
                        ]} numberOfLines={1}>
                          {change > 0 ? '+' : ''}{change}
                        </Text>
                        {isAdmin ? (
                          <TouchableOpacity 
                            style={styles.removePlayerButton}
                            onPress={() => removePlayerFromTeam(player.id, 'home')}
                          >
                            <Text style={styles.removePlayerButtonText}>×</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.removePlayerButtonPlaceholder} />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.teamPlayersContainer}>
            <Text style={styles.teamPlayersTitle}>{awayTeam.name || t('matches.team_b')}</Text>
            <ScrollView style={styles.teamPlayersList} showsVerticalScrollIndicator={false}>
              {getTeamPlayers('away').map((player, index) => {
                const ratingChanges = calculatePlayerRatingChanges();
                const change = ratingChanges[player.id] || 0;
                const newRating = player.rating + change;
                
                return (
                  <View key={`away_${player.id}_${index}`} style={styles.teamPlayerCard}>
                    <View style={styles.teamPlayerInfo}>
                      <View style={styles.teamPlayerRow}>
                        <Text style={styles.teamPlayerNumber} numberOfLines={1}>{index + 1}.</Text>
                        <Text style={styles.teamPlayerName} numberOfLines={1}>
                          {player.name.length > 10 ? player.name.substring(0, 10) + '...' : player.name}
                        </Text>
                        <Text style={styles.teamPlayerRating} numberOfLines={1}>
                          {player.rating}
                        </Text>
                        <Text style={[
                          styles.teamPlayerChange,
                          change > 0 ? styles.positiveChange : change < 0 ? styles.negativeChange : styles.neutralChange
                        ]} numberOfLines={1}>
                          {change > 0 ? '+' : ''}{change}
                        </Text>
                        {isAdmin ? (
                          <TouchableOpacity 
                            style={styles.removePlayerButton}
                            onPress={() => removePlayerFromTeam(player.id, 'away')}
                          >
                            <Text style={styles.removePlayerButtonText}>×</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.removePlayerButtonPlaceholder} />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Счет */}
      <View style={styles.scoreSection}>
        <Text style={styles.scoreTitle}>{t('matches.score')}</Text>
        <View style={styles.scoreInputs}>
          <TextInput
            style={styles.scoreInput}
            value={homeScore}
            onChangeText={(text) => {
              // Валидация: только цифры, максимум 3 символа
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 3) {
                setHomeScore(numericText);
              }
            }}
            keyboardType="numeric"
            placeholder="0"
            selectTextOnFocus={true}
            returnKeyType="done"
            maxLength={3}
          />
          <Text style={styles.scoreSeparator}>:</Text>
          <TextInput
            style={styles.scoreInput}
            value={awayScore}
            onChangeText={(text) => {
              // Валидация: только цифры, максимум 3 символа
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 3) {
                setAwayScore(numericText);
              }
            }}
            keyboardType="numeric"
            placeholder="0"
            selectTextOnFocus={true}
            returnKeyType="done"
            maxLength={3}
          />
        </View>
      </View>

      {/* Кнопки действий */}
      <View style={styles.actionButtons}>
        {isAdmin ? (
          <TouchableOpacity
            style={[
              styles.saveButton,
              (isSavingMatch) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveMatch}
            disabled={isSavingMatch}
          >
            <Text
              style={[
                styles.saveButtonText,
                isSavingMatch && styles.saveButtonTextDisabled
              ]}
            >
              {isSavingMatch
                ? `⏳ ${language === 'ru' ? 'Сохранение...' : 'Saving...'}`
                : `💾 ${language === 'ru' ? 'Сохранить матч' : 'Save Match'}`}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.saveButton, styles.saveButtonDisabled]}>
            <Text style={[styles.saveButtonText, styles.saveButtonTextDisabled]}>
              🔒 {language === 'ru' ? 'Только для администратора' : 'Admin only'}
            </Text>
          </View>
        )}
      </View>

      {/* Список матчей */}
      <View style={styles.matchesSection}>
        <Text style={styles.sectionTitle}>📋 {t('matches.history')}</Text>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>{t('matches.no_matches')}</Text>
        ) : (
          matches.slice().map((match, index) => (
            <View key={`match_${match.id}_${index}`} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.matchDate}>
                  {new Date(match.date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-GB')}
                </Text>
              </View>
              
              <View style={styles.matchTeams}>
                <View style={styles.teamInfo}>
                  {(() => {
                    // Имя команды = самый сильный текущий игрок из состава
                    const homePlayers = safePlayers.filter(p => (match.homeTeam?.playerIds || []).includes(p.id));
                    const strongest = homePlayers.slice().sort((a,b) => b.rating - a.rating)[0];
                    const homeName = strongest ? strongest.name : t('matches.team_a');
                    // Суммарная прибавка по команде
                    const rc = (match as any).ratingChanges || {};
                    const delta = (match.homeTeam?.playerIds || []).reduce((acc,id)=> acc + (rc[id] || 0), 0);
                    return (
                      <>
                        <Text style={styles.teamName} numberOfLines={1}>{homeName}</Text>
                        <Text style={[styles.ratingChange, delta>0?styles.ratingGain: delta<0?styles.ratingLoss:null]}>
                          {delta>0?`+${delta}`: delta<0?`${delta}`: '0'}
                        </Text>
                      </>
                    );
                  })()}
                  <Text style={styles.teamPlayers}>
                    {match.homeTeam.playerIds?.length || 0} {getPlayersWord(match.homeTeam.playerIds?.length || 0)}
                  </Text>
                </View>
                
                <View style={styles.scoreContainer}>
                  <Text style={styles.score}>
                    {match.homeTeam.score || 0} : {match.awayTeam.score || 0}
                  </Text>
                </View>
                
                <View style={styles.teamInfo}>
                  {(() => {
                    const awayPlayers = safePlayers.filter(p => (match.awayTeam?.playerIds || []).includes(p.id));
                    const strongest = awayPlayers.slice().sort((a,b) => b.rating - a.rating)[0];
                    const awayName = strongest ? strongest.name : t('matches.team_b');
                    const rc = (match as any).ratingChanges || {};
                    const delta = (match.awayTeam?.playerIds || []).reduce((acc,id)=> acc + (rc[id] || 0), 0);
                    return (
                      <>
                        <Text style={styles.teamName} numberOfLines={1}>{awayName}</Text>
                        <Text style={[styles.ratingChange, delta>0?styles.ratingGain: delta<0?styles.ratingLoss:null]}>
                          {delta>0?`+${delta}`: delta<0?`${delta}`: '0'}
                        </Text>
                      </>
                    );
                  })()}
                  <Text style={styles.teamPlayers}>
                    {match.awayTeam.playerIds?.length || 0} {getPlayersWord(match.awayTeam.playerIds?.length || 0)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.matchActions}>
                {(() => {
                  // Находим самый свежий матч по дате
                  const sortedMatches = matches.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const newestMatch = sortedMatches[0];
                  
                  // Показываем кнопку только для самого свежего матча и только для админа
                  return newestMatch && match.id === newestMatch.id && isAdmin && (
                    <TouchableOpacity
                      style={styles.deleteMatchButton}
                      onPress={() => handleDeleteMatch(match.id)}>
                      <Text style={styles.deleteMatchButtonText}>🗑️ {t('matches.delete_match')}</Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>
          ))
        )}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA', // tokens: color.surface
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FF9500', // оранжевый акцент из иконки
    paddingHorizontal: 24,
    paddingVertical: 12, // уменьшен с 24
    alignItems: 'center',
    shadowColor: '#1B2940',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 20, // уменьшен с 22
    fontWeight: 'bold',
    color: '#FFFFFF', // tokens: color.onPrimary
    marginBottom: 6, // уменьшен с 8
  },
  toggleParamsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 12, // уменьшен с 18
    paddingVertical: 8, // уменьшен с 12
    borderRadius: 12, // уменьшен с 14
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
  },
  toggleParamsText: {
    color: '#FFFFFF', // tokens: color.onPrimary
    fontSize: 11, // уменьшен с 13
    fontWeight: 'bold',
  },
  calculationParams: {
    backgroundColor: '#FFFFFF',
    padding: 8, // tokens: spacing.xs
    margin: 8,
    borderRadius: 12, // tokens: radii.sm
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 140,
  },
  paramsTitle: {
    fontSize: 13, // tokens: typography.caption
    fontWeight: 'bold',
    color: '#0051D5', // tokens: color.primary
    marginBottom: 4,
    textAlign: 'center',
  },
  paramsList: {
    flexDirection: 'column',
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 1,
  },
  paramItem: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 2,
    marginBottom: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  paramLabel: {
    fontSize: 7,
    color: '#355C7D', // tokens: color.inkSecondary
    fontWeight: 'bold',
  },
  paramValue: {
    fontSize: 8,
    color: '#0051D5', // tokens: color.primary
    fontWeight: 'bold',
  },
  debugInfo: {
    fontSize: 7,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
    fontStyle: 'italic',
  },
  noParamsText: {
    fontSize: 11, // уменьшен для длинных фраз
    color: '#355C7D', // tokens: color.inkSecondary
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 12,
  },
  
  // Дизайн выбора игроков
  swipeLayout: {
    flex: 1,
    padding: 5,
  },
  teamsHeader: {
    flexDirection: 'row',
    marginBottom: 3, // уменьшен с 5
  },
  teamsContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  teamPlayersContainer: {
    flex: 1,
    marginHorizontal: 2,
    minWidth: 0, // Для корректной работы flex
  },
  teamHeader: {
    backgroundColor: '#FFFFFF',
    padding: 8, // tokens: spacing.xs
    borderRadius: 12, // tokens: radii.sm
    marginHorizontal: 4,
    flex: 1,
    shadowColor: '#1B2940',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  instructionContainer: {
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 5,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 10,
    color: '#1976d2',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  playersListContainer: {
    flex: 1,
    marginBottom: 5,
  },
  playersListTitle: {
    fontSize: 11, // уменьшен с 12
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2, // уменьшен с 3
    textAlign: 'center',
  },
  playersList: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 3,
    maxHeight: 250, // увеличен для 5 игроков
    overflow: 'hidden',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginVertical: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 32,
    justifyContent: 'space-between',
  },
  playerCardDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#d0d0d0',
    opacity: 0.5,
  },
  textDisabled: {
    color: '#999',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    width: 30,
    textAlign: 'left',
  },
  playerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    width: 140,
    marginLeft: 4,
    marginRight: 8,
    textAlign: 'left',
  },
  playerRating: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
    width: 60,
    textAlign: 'right',
  },
  playerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
  },
  teamButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 15,
    borderTopWidth: 3,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderRightWidth: 2,
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
  },
  teamAButton: {
    backgroundColor: '#0051D5', // синий из палитры
  },
  teamBButton: {
    backgroundColor: '#FF9500', // оранжевый из палитры
  },
  teamButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  swipeHint: {
    marginLeft: 8,
  },
  swipeHintText: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  teamPlayersTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 3,
  },
  teamTitle: {
    fontSize: 12, // уменьшен с 13
    fontWeight: 'bold',
    color: '#355C7D', // tokens: color.inkSecondary
    textAlign: 'center',
  },
  teamStats: {
    fontSize: 9, // уменьшен с 11
    color: '#355C7D', // tokens: color.inkSecondary
    textAlign: 'center',
    marginTop: 1, // уменьшен с 2
  },
  teamRating: {
    fontSize: 10,
    color: '#2196F3',
    textAlign: 'center',
    marginTop: 1,
  },
  teamPlayersList: {
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12, // tokens: radii.sm
    padding: 8, // tokens: spacing.xs
    shadowColor: '#1B2940',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  teamPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    marginVertical: 0.5,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    justifyContent: 'space-between',
  },
  teamPlayerInfo: {
    flex: 1,
  },
  teamPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  teamPlayerNumber: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#666',
    width: 15,
    textAlign: 'left',
    marginRight: 2,
  },
  teamPlayerName: {
    fontSize: 8,
    color: '#333',
    fontWeight: 'bold',
    flex: 1,
    marginRight: 2,
  },
  teamPlayerRating: {
    fontSize: 8,
    color: '#2196F3',
    width: 40,
    textAlign: 'center',
    marginRight: 2,
  },
  teamPlayerChange: {
    fontSize: 8,
    fontWeight: 'bold',
    width: 45,
    textAlign: 'center',
    marginRight: 2,
  },
  ratingChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  ratingChange: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    marginRight: 4,
  },
  ratingChangePositive: {
    backgroundColor: '#4CAF50',
    color: '#ffffff',
  },
  ratingChangeNegative: {
    backgroundColor: '#F44336',
    color: '#ffffff',
  },
  newRating: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  removeButton: {
    padding: 1,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 8,
  },
  
  // Центральная колонка с игроками
  playersColumn: {
    flex: 2,
    marginHorizontal: 5,
    height: 400, // Фиксированная высота для центральной колонки
  },
  playersHeader: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  playersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  playersSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 0,
  },
  allPlayersList: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 5,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    height: 300, // Фиксированная высота для списка игроков
  },
  playerCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  actionButton: {
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 2,
    minWidth: 50,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 15,
    borderTopWidth: 3,
    borderTopColor: 'rgba(255, 255, 255, 0.8)', // яркий верхний свет
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
    borderRightWidth: 2,
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0, 0, 0, 0.5)', // глубокая нижняя тень
  },
  addToHomeButton: {
    backgroundColor: '#0051D5', // синий из палитры приложения
  },
  addToAwayButton: {
    backgroundColor: '#FF9500', // оранжевый из палитры приложения
  },
  actionButtonText: {
    fontSize: 16,
  },
  selectedIndicator: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 4,
  },
  selectedText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Счет
  scoreSection: {
    backgroundColor: '#FFFFFF',
    margin: 8, // уменьшен с 12
    padding: 10, // уменьшен с 16
    borderRadius: 20, // уменьшен с 24
    shadowColor: '#1B2940',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  scoreTitle: {
    fontSize: 13, // уменьшен с 14
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4, // уменьшен с 5
  },
  scoreInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10, // уменьшен с 12
    padding: 8, // уменьшен с 12
    fontSize: 22, // уменьшен с 24
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80, // увеличено с 70 для трёхзначных чисел
    marginHorizontal: 8,
    color: '#0051D5', // tokens: color.primary
  },
  scoreSeparator: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  
  // Кнопки действий
  actionButtons: {
    padding: 5,
  },
  saveButton: {
    backgroundColor: '#FF9500', // оранжевый акцент
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 }, // максимальная 3D тень
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)', // 3D highlight
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.2)', // 3D shadow edge
  },
  saveButtonText: {
    color: '#FFFFFF', // tokens: color.onPrimary
    fontSize: 16, // tokens: typography.body
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // История матчей
  matchesSection: {
    marginTop: 10,
    padding: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24, // tokens: radii.lg
    padding: 16, // tokens: spacing.md
    marginBottom: 12, // tokens: spacing.sm
    shadowColor: '#1B2940', // tokens: color.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // tokens: shadowStyle.soft
    shadowRadius: 8,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  matchDate: {
    fontSize: 12,
    color: '#666',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  teamInfo: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    maxWidth: 100,
    marginBottom: 1,
  },
  teamPlayers: {
    fontSize: 10,
    color: '#666',
  },
  ratingChange: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 1,
    textAlign: 'center',
  },
  ratingGain: {
    color: '#34C759', // iOS green
  },
  ratingLoss: {
    color: '#FF3B30', // iOS red
  },
  scoreContainer: {
    paddingHorizontal: 16,
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0051D5', // tokens: color.primary
  },
  matchActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  deleteMatchButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginLeft: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 }, // максимальная 3D тень
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)', // 3D highlight
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.2)', // 3D shadow edge
  },
  deleteMatchButtonText: {
    color: '#FFFFFF', // tokens: color.onPrimary
    fontSize: 13,
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#D3D3D3',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveButtonTextDisabled: {
    color: '#5F5F5F',
  },
  removePlayerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    padding: 0,
    margin: 0,
  },
  removePlayerButtonPlaceholder: {
    width: 20,
    height: 20,
  },
  removePlayerButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 14,
    textAlign: 'center',
    includeFontPadding: false,
    padding: 0,
    margin: 0,
    marginTop: -2,
  },
});

export default MatchesScreen;