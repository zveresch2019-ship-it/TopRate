import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRating } from '../context/RatingContext';
import { useLanguage } from '../context/LanguageContext';

const PlayersScreen = () => {
  const { players, addPlayer, editPlayer, removePlayer } = useRating();
  const { t, language } = useLanguage();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRating, setNewPlayerRating] = useState('');
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<any>(null);

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Ошибка', 'Введите имя игрока');
      return;
    }

    const rating = newPlayerRating.trim() ? parseInt(newPlayerRating) : 1500;
    if (isNaN(rating) || rating < 1000 || rating > 2000) {
      Alert.alert('Ошибка', 'Рейтинг должен быть от 1000 до 2000');
      return;
    }

    const nameToSave = newPlayerName.trim().slice(0, 10);
    const success = await addPlayer(nameToSave, rating);
    if (success) {
      setNewPlayerName('');
      setNewPlayerRating('');
      setIsAddModalVisible(false);
      Alert.alert('Успех', 'Игрок добавлен');
    } else {
      Alert.alert('Ошибка', 'Игрок с таким именем уже существует');
    }
  };

  const handlePlayerNameClick = (player: any) => {
    setEditingPlayer(player);
    setEditPlayerName(player.name);
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editPlayerName.trim()) {
      Alert.alert('Ошибка', 'Введите имя игрока');
      return;
    }

    // Ограничиваем длину имени 10 символами
    const nameToSave = editPlayerName.trim().slice(0, 10);

    if (editingPlayer) {
      const success = await editPlayer(editingPlayer.id, nameToSave, editingPlayer.rating);
      if (success) {
        setEditPlayerName('');
        setEditingPlayer(null);
        setIsEditModalVisible(false);
        Alert.alert('Успех', 'Имя игрока изменено');
      } else {
        Alert.alert('Ошибка', 'Игрок с таким именем уже существует');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditPlayerName('');
    setEditingPlayer(null);
    setIsEditModalVisible(false);
  };

  const handleDeletePlayer = (player: any) => {
    Alert.alert(
      'Удалить игрока',
      `Удалить игрока "${player.name}"? Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await removePlayer(player.id);
            Alert.alert('Успех', 'Игрок удален');
          },
        },
      ]
    );
  };

  const openPlayerActions = (player: any) => {
    Alert.alert(
      'Действия с игроком',
      'Выберите действие:',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Переименовать', onPress: () => handlePlayerNameClick(player) },
        { text: 'Удалить', style: 'destructive', onPress: () => handleDeletePlayer(player) },
      ]
    );
  };

  // Сортировка игроков по рейтингу
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>👥 {t('players.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('players.by_game')}
            {players.length > 0 && (
              (() => {
                const lastMatchDate = new Date(Math.max(
                  ...players.map(p => new Date(p.dateCreated || new Date(0)).getTime())
                ));
                const formatted = lastMatchDate.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-GB');
                return ` • ${formatted}`;
              })()
            )}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}>
          <Text style={styles.addButtonText}>{t('players.add_player')}</Text>
        </TouchableOpacity>
      </View>

      {/* Таблица игроков */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
        <ScrollView style={styles.verticalScroll}>
          {players.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('players.no_players')}</Text>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              {/* Заголовок таблицы */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.rankColumn]}>{language === 'en' ? '#' : '№'}</Text>
                <Text style={[styles.tableHeaderCell, styles.nameColumn]}>{t('players.name')}</Text>
                <Text style={[styles.tableHeaderCell, styles.ratingColumn]}>{t('players.before')}</Text>
                <Text style={[styles.tableHeaderCell, styles.changeColumn]}>{t('players.change')}</Text>
                <Text style={[styles.tableHeaderCell, styles.ratingAfterColumn]}>{t('players.after')}</Text>
                <Text style={[styles.tableHeaderCell, styles.gamesColumn]}>{t('players.matches_short')}</Text>
                <Text style={[styles.tableHeaderCell, styles.seasonColumn]}>{language === 'en' ? 'Total' : t('players.season')}</Text>
              </View>

              {/* Строки таблицы */}
              {sortedPlayers.map((player, index) => {
                const ratingBeforeLastGame = player.rating - player.lastRatingChange;
                const seasonChange = player.rating - player.seasonStartRating;
                const changeText = player.lastRatingChange > 0 
                  ? `+${player.lastRatingChange}` 
                  : player.lastRatingChange < 0 
                  ? `${player.lastRatingChange}` 
                  : '0';
                const seasonChangeText = seasonChange > 0 
                  ? `+${seasonChange}` 
                  : seasonChange < 0 
                  ? `${seasonChange}` 
                  : '0';

                return (
                  <View key={player.id} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.rankColumn, styles.rankText]}>
                      {index + 1}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.tableCell, styles.nameColumn]}
                      onPress={() => openPlayerActions(player)}>
                      <Text style={[styles.tableCell, styles.nameText, styles.nameClickableText]} numberOfLines={1} ellipsizeMode="clip">
                        {player.name.length > 10 ? player.name.slice(0, 10) : player.name}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.tableCell, styles.ratingColumn]}>
                      {ratingBeforeLastGame}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      styles.changeColumn,
                      player.lastRatingChange > 0 ? styles.positiveChange : 
                      player.lastRatingChange < 0 ? styles.negativeChange : styles.neutralChange
                    ]}>
                      {changeText}
                    </Text>
                    <Text style={[styles.tableCell, styles.ratingAfterColumn, styles.currentRatingText]}>
                      {player.rating}
                    </Text>
                    <Text style={[styles.tableCell, styles.gamesColumn]}>
                      {player.matchesPlayed}
                    </Text>
                    <Text style={[
                      styles.tableCell, 
                      styles.seasonColumn,
                      seasonChange > 0 ? styles.positiveChange : 
                      seasonChange < 0 ? styles.negativeChange : styles.neutralChange
                    ]}>
                      {seasonChangeText}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </ScrollView>

      {/* Модальное окно добавления игрока */}
      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('players.add_player')}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder={t('players.player_name')}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              maxLength={10}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder={t('players.initial_rating_placeholder')}
              value={newPlayerRating}
              onChangeText={setNewPlayerRating}
              keyboardType="numeric"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsAddModalVisible(false)}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddPlayer}>
                <Text style={styles.saveButtonText}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно редактирования игрока */}
      <Modal
        visible={isEditModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelEdit}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('players.rename_player')}</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder={t('players.enter_new_name')}
              value={editPlayerName}
              onChangeText={setEditPlayerName}
              maxLength={10}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelEdit}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveEdit}>
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#E3F2FD',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  horizontalScroll: {
    flex: 1,
  },
  verticalScroll: {
    flex: 1,
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    margin: 10,
    marginLeft: 2,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
    paddingVertical: 10,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  tableCell: {
    fontSize: 10,
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  // Ширины колонок (оптимизированы для мобильного экрана)
  rankColumn: {
    width: 24,
    minWidth: 24,
    paddingHorizontal: 0,
  },
  nameColumn: {
    width: 115,
    minWidth: 115,
  },
  ratingColumn: {
    width: 60,
    minWidth: 60,
  },
  ratingAfterColumn: {
    width: 62,
    minWidth: 62,
  },
  changeColumn: {
    width: 52,
    minWidth: 52,
  },
  gamesColumn: {
    width: 51,
    minWidth: 51,
  },
  seasonColumn: {
    width: 63,
    minWidth: 63,
  },
  // Специальные стили
  rankText: {
    color: '#2196F3',
    fontSize: 7,
  },
  nameText: {
    fontWeight: 'normal',
    fontSize: 10,
    textAlign: 'left',
  },
  nameClickableText: {
    color: '#1976D2',
    textDecorationLine: 'underline',
  },
  currentRatingText: {
    color: '#2196F3',
  },
  positiveChange: {
    color: '#4CAF50',
  },
  negativeChange: {
    color: '#f44336',
  },
  neutralChange: {
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default PlayersScreen;
