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
  const { players, addPlayer, editPlayer, deletePlayer } = useRating();
  const { t } = useLanguage();
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
    if (isNaN(rating) || rating < 0) {
      Alert.alert('Ошибка', 'Введите корректный рейтинг');
      return;
    }

    const success = await addPlayer(newPlayerName.trim(), rating);
    if (success) {
      setNewPlayerName('');
      setNewPlayerRating('');
      setIsAddModalVisible(false);
      Alert.alert('Успех', 'Игрок добавлен');
    } else {
      Alert.alert('Ошибка', 'Не удалось добавить игрока');
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

    if (editingPlayer) {
      const success = await editPlayer(editingPlayer.id, editPlayerName.trim(), editingPlayer.rating);
      if (success) {
        setEditPlayerName('');
        setEditingPlayer(null);
        setIsEditModalVisible(false);
        Alert.alert('Успех', 'Игрок переименован');
      } else {
        Alert.alert('Ошибка', 'Не удалось переименовать игрока');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditPlayerName('');
    setEditingPlayer(null);
    setIsEditModalVisible(false);
  };

  const handlePlayerActions = (player: any) => {
    Alert.alert(
      t('messages.player_actions_title'),
      t('messages.player_actions_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.rename'),
          onPress: () => handlePlayerNameClick(player),
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => handleDeletePlayer(player),
        },
      ]
    );
  };

  const handleDeletePlayer = (player: any) => {
    Alert.alert(
      t('messages.delete_player_title'),
      t('messages.delete_player_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await deletePlayer(player.id);
            if (success) {
              Alert.alert('Успех', 'Игрок удален');
            } else {
              Alert.alert('Ошибка', 'Не удалось удалить игрока');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('players.rating')}</Text>
          <Text style={styles.headerSubtitle}>{t('players.by_game')}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}>
          <Text style={styles.addButtonText}>{t('players.new_player')}</Text>
        </TouchableOpacity>
      </View>

      {/* Список игроков */}
      <ScrollView style={styles.playersList}>
        {players.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('players.no_players')}</Text>
          </View>
        ) : (
          players.map((player, index) => (
            <TouchableOpacity
              key={player.id}
              style={styles.playerRow}
              onPress={() => handlePlayerActions(player)}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerRank}>{index + 1}</Text>
                <View style={styles.playerDetails}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerRating}>{player.rating}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
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
              placeholder="Имя игрока"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Рейтинг (по умолчанию 1500)"
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
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddPlayer}>
                <Text style={styles.addButtonText}>{t('common.add')}</Text>
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
              placeholder="Имя игрока"
              value={editPlayerName}
              onChangeText={setEditPlayerName}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCancelEdit}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleSaveEdit}>
                <Text style={styles.addButtonText}>{t('common.save')}</Text>
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
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitleContainer: {
    flex: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 1,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  playersList: {
    flex: 1,
  },
  playerRow: {
    backgroundColor: '#ffffff',
    marginHorizontal: 10,
    marginVertical: 4,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerRank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    width: 30,
  },
  playerDetails: {
    flex: 1,
    marginLeft: 10,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  playerRating: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
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
    width: '80%',
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
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#4CAF50',
  },
  addButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default PlayersScreen;

