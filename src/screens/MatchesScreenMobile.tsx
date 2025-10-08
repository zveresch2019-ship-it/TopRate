import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {useRating} from '../context/RatingContext';
import {Player, Team} from '../types';

const MatchesScreenMobile: React.FC = () => {
  const {players, matches, addMatch, editMatch, removeMatch, getRecentMatches} = useRating();
  const [homeTeam, setHomeTeam] = useState<Team>({id: 'home', name: 'Команда A', playerIds: [], totalRating: 0});
  const [awayTeam, setAwayTeam] = useState<Team>({id: 'away', name: 'Команда B', playerIds: [], totalRating: 0});
  const [homeScore, setHomeScore] = useState<string>('0');
  const [awayScore, setAwayScore] = useState<string>('0');
  const [competition, setCompetition] = useState<string>('Матч');
  
  // Состояние для редактирования матча
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const updateTeamName = (teamType: 'home' | 'away') => {
    const team = teamType === 'home' ? homeTeam : awayTeam;
    const teamPlayers = getTeamPlayers(teamType);
    
    if (teamPlayers.length === 0) {
      const newName = teamType === 'home' ? 'Команда A' : 'Команда B';
      if (teamType === 'home') {
        setHomeTeam(prev => ({...prev, name: newName}));
      } else {
        setAwayTeam(prev => ({...prev, name: newName}));
      }
      return;
    }

    const highestRatedPlayer = teamPlayers.reduce((prev, current) => 
      (prev.rating > current.rating) ? prev : current
    );
    
    const newName = `${highestRatedPlayer.name}`;
    if (teamType === 'home') {
      setHomeTeam(prev => ({...prev, name: newName}));
    } else {
      setAwayTeam(prev => ({...prev, name: newName}));
    }
  };

  const getTeamPlayers = (teamType: 'home' | 'away'): Player[] => {
    const team = teamType === 'home' ? homeTeam : awayTeam;
    return players.filter(player => team.playerIds.includes(player.id));
  };

  const addPlayerToTeam = (playerId: string, teamType: 'home' | 'away') => {
    console.log(`addPlayerToTeam: adding player ${playerId} to ${teamType} team`);
    
    const team = teamType === 'home' ? homeTeam : awayTeam;
    
    // Проверяем, что игрок не в другой команде
    const otherTeam = teamType === 'home' ? awayTeam : homeTeam;
    if (otherTeam.playerIds.includes(playerId)) {
      Alert.alert('Ошибка', 'Игрок уже в другой команде');
      return;
    }
    
    // Проверяем, что игрок не в этой команде
    if (team.playerIds.includes(playerId)) {
      Alert.alert('Ошибка', 'Игрок уже в этой команде');
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
      setHomeTeam(prev => ({
        ...prev,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      }));
    } else {
      setAwayTeam(prev => ({
        ...prev,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      }));
    }

    // Обновляем название команды
    setTimeout(() => updateTeamName(teamType), 100);
  };

  const removePlayerFromTeam = (playerId: string, teamType: 'home' | 'away') => {
    const team = teamType === 'home' ? homeTeam : awayTeam;
    const newPlayerIds = team.playerIds.filter(id => id !== playerId);
    const newTotalRating = newPlayerIds.reduce((sum, id) => {
      const p = players.find(pl => pl.id === id);
      return sum + (p?.rating || 0);
    }, 0);

    if (teamType === 'home') {
      setHomeTeam(prev => ({
        ...prev,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      }));
    } else {
      setAwayTeam(prev => ({
        ...prev,
        playerIds: newPlayerIds,
        totalRating: newTotalRating
      }));
    }

    // Обновляем название команды
    setTimeout(() => updateTeamName(teamType), 100);
  };

  const handleSaveMatch = async () => {
    // Проверки
    if (homeTeam.playerIds.length === 0 || awayTeam.playerIds.length === 0) {
      Alert.alert('Ошибка', 'В каждой команде должен быть хотя бы один игрок');
      return;
    }

    const homeScoreNum = parseInt(homeScore);
    const awayScoreNum = parseInt(awayScore);

    if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
      Alert.alert('Ошибка', 'Введите корректный счет');
      return;
    }

    if (isEditMode && editingMatchId) {
      // Редактируем существующий матч
      const success = await editMatch(editingMatchId, homeTeam, awayTeam, homeScoreNum, awayScoreNum, competition);
      if (success) {
        Alert.alert('Успех', 'Матч обновлен!');
        resetForm();
      } else {
        Alert.alert('Ошибка', 'Не удалось обновить матч');
      }
    } else {
      // Добавляем новый матч
      const success = await addMatch(homeTeam, awayTeam, homeScoreNum, awayScoreNum, competition);
      if (success) {
        Alert.alert('Успех', 'Матч сохранен!');
        resetForm();
      } else {
        Alert.alert('Ошибка', 'Не удалось сохранить матч');
      }
    }
  };

  const resetForm = () => {
    setHomeTeam({id: 'home', name: 'Команда A', playerIds: [], totalRating: 0});
    setAwayTeam({id: 'away', name: 'Команда B', playerIds: [], totalRating: 0});
    setHomeScore('0');
    setAwayScore('0');
    setCompetition('Матч');
    setIsEditMode(false);
    setEditingMatchId(null);
  };

  const handleEditMatch = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    setHomeTeam(match.homeTeam);
    setAwayTeam(match.awayTeam);
    setHomeScore(match.homeScore.toString());
    setAwayScore(match.awayScore.toString());
    setCompetition(match.competition);
    setIsEditMode(true);
    setEditingMatchId(matchId);
  };

  const handleDeleteMatch = (matchId: string) => {
    Alert.alert(
      'Удалить матч',
      'Вы уверены, что хотите удалить этот матч? Все рейтинги будут пересчитаны.',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => removeMatch(matchId),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>⚽ Добавить матч</Text>
      </View>

      {/* Новый мобильный дизайн */}
      <View style={styles.mobileLayout}>
        {/* Команда A (слева) */}
        <View style={styles.teamColumn}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamTitle}>🏠 {homeTeam.name}</Text>
            <Text style={styles.teamStats}>
              {homeTeam.playerIds.length} игроков
            </Text>
            <Text style={styles.teamRating}>Рейтинг: {homeTeam.totalRating}</Text>
          </View>
          
          <ScrollView style={styles.teamPlayersList} showsVerticalScrollIndicator={false}>
            {getTeamPlayers('home').map((player, index) => (
              <View key={`home_${player.id}_${index}`} style={styles.teamPlayerCard}>
                <Text style={styles.teamPlayerName}>{index + 1}. {player.name}</Text>
                <Text style={styles.teamPlayerRating}>{player.rating}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePlayerFromTeam(player.id, 'home')}>
                  <Text style={styles.removeButtonText}>❌</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Центральный список всех игроков */}
        <View style={styles.playersColumn}>
          <Text style={styles.playersTitle}>Выберите игроков</Text>
          <Text style={styles.playersSubtitle}>Нажмите кнопку для добавления в команду</Text>
          
          <ScrollView style={styles.allPlayersList} showsVerticalScrollIndicator={false}>
            {players.map((player, index) => {
              const isInHomeTeam = homeTeam.playerIds.includes(player.id);
              const isInAwayTeam = awayTeam.playerIds.includes(player.id);
              const isSelected = isInHomeTeam || isInAwayTeam;
              
              return (
                <View key={`player_${player.id}_${index}`} style={[
                  styles.playerCard,
                  isSelected && styles.playerCardSelected
                ]}>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.name}</Text>
                    <Text style={styles.playerRating}>Рейтинг: {player.rating}</Text>
                  </View>
                  
                  <View style={styles.playerActions}>
                    {!isSelected ? (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.addToHomeButton]}
                          onPress={() => addPlayerToTeam(player.id, 'home')}>
                          <Text style={styles.actionButtonText}>🏠</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.addToAwayButton]}
                          onPress={() => addPlayerToTeam(player.id, 'away')}>
                          <Text style={styles.actionButtonText}>✈️</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedText}>
                          {isInHomeTeam ? '🏠 Команда A' : '✈️ Команда B'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Команда B (справа) */}
        <View style={styles.teamColumn}>
          <View style={styles.teamHeader}>
            <Text style={styles.teamTitle}>✈️ {awayTeam.name}</Text>
            <Text style={styles.teamStats}>
              {awayTeam.playerIds.length} игроков
            </Text>
            <Text style={styles.teamRating}>Рейтинг: {awayTeam.totalRating}</Text>
          </View>
          
          <ScrollView style={styles.teamPlayersList} showsVerticalScrollIndicator={false}>
            {getTeamPlayers('away').map((player, index) => (
              <View key={`away_${player.id}_${index}`} style={styles.teamPlayerCard}>
                <Text style={styles.teamPlayerName}>{index + 1}. {player.name}</Text>
                <Text style={styles.teamPlayerRating}>{player.rating}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePlayerFromTeam(player.id, 'away')}>
                  <Text style={styles.removeButtonText}>❌</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Счет */}
      <View style={styles.scoreSection}>
        <Text style={styles.scoreTitle}>Счет:</Text>
        <View style={styles.scoreInputs}>
          <TextInput
            style={styles.scoreInput}
            value={homeScore}
            onChangeText={setHomeScore}
            keyboardType="numeric"
            placeholder="0"
          />
          <Text style={styles.scoreSeparator}>:</Text>
          <TextInput
            style={styles.scoreInput}
            value={awayScore}
            onChangeText={setAwayScore}
            keyboardType="numeric"
            placeholder="0"
          />
        </View>
      </View>

      {/* Кнопки действий */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveMatch}>
          <Text style={styles.saveButtonText}>
            {isEditMode ? '💾 Обновить матч' : '💾 Сохранить матч'}
          </Text>
        </TouchableOpacity>

        {isEditMode && (
          <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
            <Text style={styles.cancelButtonText}>❌ Отменить</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Список матчей */}
      <View style={styles.matchesSection}>
        <Text style={styles.sectionTitle}>📋 История матчей</Text>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>Нет сохраненных матчей</Text>
        ) : (
          matches.slice().reverse().map((match, index) => (
            <View key={`match_${match.id}_${index}`} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <Text style={styles.matchDate}>
                  {new Date(match.date).toLocaleDateString('ru-RU')}
                </Text>
                <Text style={styles.matchCompetition}>{match.competition}</Text>
              </View>
              
              <View style={styles.matchTeams}>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{match.homeTeam.name}</Text>
                  <Text style={styles.teamPlayers}>
                    {match.homeTeam.playerIds.length} игроков
                  </Text>
                </View>
                
                <View style={styles.scoreContainer}>
                  <Text style={styles.score}>
                    {match.homeScore} : {match.awayScore}
                  </Text>
                </View>
                
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{match.awayTeam.name}</Text>
                  <Text style={styles.teamPlayers}>
                    {match.awayTeam.playerIds.length} игроков
                  </Text>
                </View>
              </View>
              
              <View style={styles.matchActions}>
                <TouchableOpacity
                  style={styles.editMatchButton}
                  onPress={() => handleEditMatch(match.id)}>
                  <Text style={styles.editMatchButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteMatchButton}
                  onPress={() => handleDeleteMatch(match.id)}>
                  <Text style={styles.deleteMatchButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  
  // Новый мобильный дизайн
  mobileLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
  },
  teamColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  teamHeader: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  teamTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  teamStats: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  teamRating: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    marginTop: 2,
  },
  teamPlayersList: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 5,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  teamPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginVertical: 2,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  teamPlayerName: {
    flex: 1,
    fontSize: 12,
    color: '#333',
  },
  teamPlayerRating: {
    fontSize: 10,
    color: '#2196F3',
    marginRight: 5,
  },
  removeButton: {
    padding: 2,
  },
  removeButtonText: {
    fontSize: 12,
  },
  
  // Центральная колонка с игроками
  playersColumn: {
    flex: 2,
    marginHorizontal: 5,
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
    marginBottom: 10,
  },
  allPlayersList: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 5,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginVertical: 2,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  playerCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  playerRating: {
    fontSize: 12,
    color: '#666',
  },
  playerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    margin: 10,
    padding: 15,
    borderRadius: 8,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  scoreInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80,
    marginHorizontal: 10,
  },
  scoreSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  
  // Кнопки действий
  actionButtons: {
    padding: 10,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // История матчей
  matchesSection: {
    marginTop: 20,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
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
    padding: 15,
    marginBottom: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  matchDate: {
    fontSize: 14,
    color: '#666',
  },
  matchCompetition: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  teamInfo: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  teamPlayers: {
    fontSize: 12,
    color: '#666',
  },
  scoreContainer: {
    paddingHorizontal: 20,
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  matchActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  editMatchButton: {
    padding: 8,
  },
  editMatchButtonText: {
    fontSize: 18,
  },
  deleteMatchButton: {
    padding: 8,
  },
  deleteMatchButtonText: {
    fontSize: 18,
  },
});

export default MatchesScreenMobile;
