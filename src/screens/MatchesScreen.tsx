import React, {useState, useEffect} from 'react';
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
import {Player, Team} from '../types';


const MatchesScreen: React.FC = () => {
  const { t, language } = useLanguage();
  const {players, matches, addMatch, editMatch, removeMatch, deleteMatch, getRecentMatches} = useRating();
  const [homeTeam, setHomeTeam] = useState<Team>({id: 'home', name: 'Команда A', playerIds: [], totalRating: 0});
  const [awayTeam, setAwayTeam] = useState<Team>({id: 'away', name: 'Команда B', playerIds: [], totalRating: 0});
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');
  const [competition, setCompetition] = useState<string>('Матч');
  
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
    const updateTeamRating = (team: Team) => {
      const newTotalRating = team.playerIds.reduce((sum, id) => {
        const p = players.find(pl => pl.id === id);
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
  }, [players]);
  
  // Функция для расчета изменений рейтинга игроков
  const calculatePlayerRatingChanges = () => {
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
    
    const RD = winnerSum - loserSum;
    const totalPlayers = homeTeam.playerIds.length + awayTeam.playerIds.length;
    const ES = (RD / (totalPlayers / 2)) / 200 * 6;
    const goalDiff = winnerScore - loserScore;
    const goalRatio = loserScore / winnerScore;
    const RGD = goalDiff * ((0.8 - goalRatio) + 1);
    const GV = 7 * ((12 - totalPlayers) / 10 + 1);
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
    return players
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

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const newPlayerIds = [...team.playerIds, playerId];
    const newTotalRating = newPlayerIds.reduce((sum, id) => {
      const p = players.find(pl => pl.id === id);
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
      const p = players.find(pl => pl.id === id);
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
    // Проверки
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Error', t('messages.team_must_have_players'));
      return;
    }

    const homeScoreNum = parseInt(homeScore) || 0;
    const awayScoreNum = parseInt(awayScore) || 0;

    if (homeScoreNum < 0 || awayScoreNum < 0) {
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Error', t('messages.enter_valid_score'));
      return;
    }

    // Добавляем новый матч
    const success = await addMatch(homeTeam, awayTeam, homeScoreNum, awayScoreNum, competition);
    if (success) {
      // Сбрасываем флаг отмены при добавлении нового матча
      setIsLastMatchCancelled(false);
      await saveCancelState(false);
      Alert.alert(t('messages.match_saved_success'));
      resetForm();
    } else {
      Alert.alert(language === 'ru' ? 'Ошибка' : 'Error', t('messages.match_save_error'));
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
            <Text style={styles.teamTitle}>{t('matches.team_a')}</Text>
            <Text style={styles.teamStats}>
              {homeTeam.playerIds.length} {getPlayersWord(homeTeam.playerIds.length)} • {t('messages.rating_label')}: {homeTeam.totalRating}
            </Text>
          </View>
          <View style={styles.teamHeader}>
            <Text style={styles.teamTitle}>{t('matches.team_b')}</Text>
            <Text style={styles.teamStats}>
              {awayTeam.playerIds.length} {getPlayersWord(awayTeam.playerIds.length)} • {t('messages.rating_label')}: {awayTeam.totalRating}
            </Text>
          </View>
        </View>


        {/* Список доступных игроков */}
        <View style={styles.playersListContainer}>
          <Text style={styles.playersListTitle}>
            {t('messages.available_players')} ({players.filter(p => !homeTeam.playerIds.includes(p.id) && !awayTeam.playerIds.includes(p.id)).length})
          </Text>
          <ScrollView style={styles.playersList} showsVerticalScrollIndicator={true}>
            {players
              .filter(player => !homeTeam.playerIds.includes(player.id) && !awayTeam.playerIds.includes(player.id))
              .sort((a, b) => b.rating - a.rating)
              .map((player, index) => (
                <View key={player.id} style={styles.playerCard}>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerNumber} numberOfLines={1}>{index + 1}.</Text>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {player.name.length > 12 ? player.name.substring(0, 12) + '...' : player.name}
                    </Text>
                    <Text style={styles.playerRating} numberOfLines={1}>{Math.round(player.rating)}</Text>
                  </View>
                  <View style={styles.playerActions}>
                    <TouchableOpacity
                      style={[styles.teamButton, styles.teamAButton]}
                      onPress={() => addPlayerToTeam(player.id, 'home')}
                    >
                      <Text style={styles.teamButtonText}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.teamButton, styles.teamBButton]}
                      onPress={() => addPlayerToTeam(player.id, 'away')}
                    >
                      <Text style={styles.teamButtonText}>B</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </ScrollView>
        </View>

        {/* Списки игроков в командах */}
        <View style={styles.teamsContainer}>
          <View style={styles.teamPlayersContainer}>
            <Text style={styles.teamPlayersTitle}>{t('matches.team_a')}</Text>
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
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removePlayerFromTeam(player.id, 'home')}>
                      <Text style={styles.removeButtonText}>❌</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.teamPlayersContainer}>
            <Text style={styles.teamPlayersTitle}>{t('matches.team_b')}</Text>
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
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removePlayerFromTeam(player.id, 'away')}>
                      <Text style={styles.removeButtonText}>❌</Text>
                    </TouchableOpacity>
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
            onChangeText={setHomeScore}
            keyboardType="numeric"
            placeholder="0"
            selectTextOnFocus={true}
            returnKeyType="done"
            maxLength={2}
          />
          <Text style={styles.scoreSeparator}>:</Text>
          <TextInput
            style={styles.scoreInput}
            value={awayScore}
            onChangeText={setAwayScore}
            keyboardType="numeric"
            placeholder="0"
            selectTextOnFocus={true}
            returnKeyType="done"
            maxLength={2}
          />
        </View>
      </View>

      {/* Кнопки действий */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveMatch}>
          <Text style={styles.saveButtonText}>💾 {t('matches.save_match')}</Text>
        </TouchableOpacity>
      </View>

      {/* Список матчей */}
      <View style={styles.matchesSection}>
        <Text style={styles.sectionTitle}>📋 {t('matches.history')}</Text>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>{t('matches.no_matches')}</Text>
        ) : (
          matches.slice().reverse().map((match, index) => (
            <View key={`match_${match.id}_${index}`} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.matchDate}>
                  {new Date(match.date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-GB')}
                </Text>
              </View>
              
              <View style={styles.matchTeams}>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {match.homeTeam.name.length > 12 ? match.homeTeam.name.substring(0, 12) + '...' : match.homeTeam.name}
                  </Text>
                  <Text style={styles.teamPlayers}>
                    {match.homeTeam.playerIds.length} игрок{match.homeTeam.playerIds.length === 1 ? '' : match.homeTeam.playerIds.length < 5 ? 'а' : 'ов'}
                  </Text>
                  {(() => {
                    const homeTeamRatingChange = match.homeTeam.playerIds.reduce((total, playerId) => {
                      return total + (match.ratingChanges[playerId] || 0);
                    }, 0);
                    return (
                      <Text style={[
                        styles.ratingChange,
                        homeTeamRatingChange >= 0 ? styles.ratingGain : styles.ratingLoss
                      ]}>
                        {homeTeamRatingChange >= 0 ? '+' : ''}{homeTeamRatingChange}
                      </Text>
                    );
                  })()}
                </View>
                
                <View style={styles.scoreContainer}>
                  <Text style={styles.score}>
                    {match.homeScore} : {match.awayScore}
                  </Text>
                </View>
                
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {match.awayTeam.name.length > 12 ? match.awayTeam.name.substring(0, 12) + '...' : match.awayTeam.name}
                  </Text>
                  <Text style={styles.teamPlayers}>
                    {match.awayTeam.playerIds.length} игрок{match.awayTeam.playerIds.length === 1 ? '' : match.awayTeam.playerIds.length < 5 ? 'а' : 'ов'}
                  </Text>
                  {(() => {
                    const awayTeamRatingChange = match.awayTeam.playerIds.reduce((total, playerId) => {
                      return total + (match.ratingChanges[playerId] || 0);
                    }, 0);
                    return (
                      <Text style={[
                        styles.ratingChange,
                        awayTeamRatingChange >= 0 ? styles.ratingGain : styles.ratingLoss
                      ]}>
                        {awayTeamRatingChange >= 0 ? '+' : ''}{awayTeamRatingChange}
                      </Text>
                    );
                  })()}
                </View>
              </View>
              
              <View style={styles.matchActions}>
                {(() => {
                  // Находим самый свежий матч по дате
                  const sortedMatches = matches.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const newestMatch = sortedMatches[0];
                  
                  // Показываем кнопку только для самого свежего матча
                  return newestMatch && match.id === newestMatch.id && (
                    <TouchableOpacity
                      style={styles.deleteMatchButton}
                      onPress={() => handleDeleteMatch(match.id)}>
                      <Text style={styles.deleteMatchButtonText}>🗑️ Отмена</Text>
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
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  toggleParamsButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  toggleParamsText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  calculationParams: {
    backgroundColor: '#f0f8ff',
    padding: 3,
    margin: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
    maxHeight: 140,
  },
  paramsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
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
    color: '#666',
    fontWeight: 'bold',
  },
  paramValue: {
    fontSize: 8,
    color: '#2196F3',
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
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  
  // Дизайн выбора игроков
  swipeLayout: {
    flex: 1,
    padding: 5,
  },
  teamsHeader: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  teamsContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  teamPlayersContainer: {
    flex: 1,
    marginHorizontal: 2,
  },
  teamHeader: {
    backgroundColor: '#ffffff',
    padding: 5,
    borderRadius: 6,
    marginHorizontal: 2,
    flex: 1,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
    textAlign: 'center',
  },
  playersList: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 3,
    maxHeight: 150,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  teamAButton: {
    backgroundColor: '#4CAF50',
  },
  teamBButton: {
    backgroundColor: '#2196F3',
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
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  teamStats: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 1,
  },
  teamRating: {
    fontSize: 10,
    color: '#2196F3',
    textAlign: 'center',
    marginTop: 1,
  },
  teamPlayersList: {
    height: 120, // Фиксированная высота для списка команды
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 3,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
  },
  teamPlayerNumber: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#666',
    width: 12,
    textAlign: 'left',
  },
  teamPlayerName: {
    fontSize: 8,
    color: '#333',
    fontWeight: 'bold',
    width: 75,
    marginLeft: 1,
    marginRight: 1,
  },
  teamPlayerRating: {
    fontSize: 8,
    color: '#2196F3',
    width: 40,
    textAlign: 'center',
    marginRight: 1,
  },
  teamPlayerChange: {
    fontSize: 8,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
    marginRight: 1,
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
    padding: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  addToHomeButton: {
    backgroundColor: '#4CAF50',
  },
  addToAwayButton: {
    backgroundColor: '#FF9800',
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
    backgroundColor: '#ffffff',
    margin: 5,
    padding: 8,
    borderRadius: 6,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  scoreInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 6,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 60,
    marginHorizontal: 8,
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
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
    color: '#4CAF50',
  },
  ratingLoss: {
    color: '#F44336',
  },
  scoreContainer: {
    paddingHorizontal: 12,
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  matchActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  deleteMatchButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  deleteMatchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default MatchesScreen;