import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import {useRating} from '../context/RatingContext';
import {Player} from '../types';

const RatingScreen: React.FC = () => {
  const {
    getPlayerRanking,
    getTotalPlayers,
    getTotalMatches,
    getAverageRating,
    getPlayerMatches,
  } = useRating();

  const ranking = getPlayerRanking();
  const totalPlayers = getTotalPlayers();
  const totalMatches = getTotalMatches();
  const averageRating = getAverageRating();

  const handleShareRanking = async () => {
    try {
      let rankingText = '🏆 РЕЙТИНГ ИГРОКОВ\n\n';
      
      ranking.forEach((player, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const winPercentage = player.matchesPlayed > 0 
          ? ((player.wins / player.matchesPlayed) * 100).toFixed(1)
          : '0.0';
        
        rankingText += `${medal} ${player.name} - ${player.rating}\n`;
        rankingText += `   Матчей: ${player.matchesPlayed}, Побед: ${player.wins} (${winPercentage}%)\n`;
        rankingText += `   Голы: ${player.goalsScored}-${player.goalsConceded}\n\n`;
      });

      rankingText += `\n📊 Статистика:\n`;
      rankingText += `Игроков: ${totalPlayers}\n`;
      rankingText += `Матчей: ${totalMatches}\n`;
      rankingText += `Средний рейтинг: ${averageRating}`;

      await Share.share({
        message: rankingText,
        title: 'Футбольный Рейтинг',
      });
    } catch (error) {
      console.error('Ошибка при попытке поделиться:', error);
    }
  };

  const handlePlayerPress = (player: Player) => {
    const matches = getPlayerMatches(player.name);
    const winPercentage = player.matchesPlayed > 0 
      ? ((player.wins / player.matchesPlayed) * 100).toFixed(1)
      : '0.0';

    const message = `📊 ${player.name}\n\n` +
      `🏆 Рейтинг: ${player.rating}\n` +
      `⚽ Матчей: ${player.matchesPlayed}\n` +
      `✅ Побед: ${player.wins} (${winPercentage}%)\n` +
      `🤝 Ничьих: ${player.draws}\n` +
      `❌ Поражений: ${player.losses}\n` +
      `🥅 Голы: ${player.goalsScored}-${player.goalsConceded}\n` +
      `📈 Разность: ${player.goalsScored - player.goalsConceded}\n` +
      `📅 Последних матчей: ${matches.length}`;

    Alert.alert('Статистика игрока', message, [{text: 'OK'}]);
  };

  const renderPlayer = ({item, index}: {item: Player; index: number}) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    const winPercentage = item.matchesPlayed > 0 
      ? ((item.wins / item.matchesPlayed) * 100).toFixed(1)
      : '0.0';

    return (
      <TouchableOpacity
        style={[
          styles.playerCard,
          rank <= 3 && styles.topPlayerCard,
        ]}
        onPress={() => handlePlayerPress(item)}>
        <View style={styles.playerHeader}>
          <View style={styles.rankContainer}>
            {medal ? (
              <Text style={styles.medal}>{medal}</Text>
            ) : (
              <Text style={styles.rankNumber}>#{rank}</Text>
            )}
          </View>
          
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{item.name}</Text>
            <Text style={styles.playerRating}>Рейтинг: {item.rating}</Text>
          </View>
          
          <View style={styles.statsContainer}>
            <Text style={styles.matchesText}>{item.matchesPlayed} матчей</Text>
            <Text style={styles.winRateText}>{winPercentage}% побед</Text>
          </View>
        </View>
        
        <View style={styles.playerDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailValue}>{item.wins}</Text>
            <Text style={styles.detailLabel}>Побед</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailValue}>{item.draws}</Text>
            <Text style={styles.detailLabel}>Ничьих</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailValue}>{item.losses}</Text>
            <Text style={styles.detailLabel}>Поражений</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailValue}>
              {item.goalsScored}-{item.goalsConceded}
            </Text>
            <Text style={styles.detailLabel}>Голы</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (ranking.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Нет данных</Text>
          <Text style={styles.emptyText}>
            Добавьте игроков и проведите матчи для создания рейтинга
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Статистика */}
      <View style={styles.statsHeader}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalPlayers}</Text>
          <Text style={styles.statLabel}>Игроков</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalMatches}</Text>
          <Text style={styles.statLabel}>Матчей</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{averageRating}</Text>
          <Text style={styles.statLabel}>Средний рейтинг</Text>
        </View>
      </View>

      {/* Кнопка поделиться */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShareRanking}>
        <Text style={styles.shareButtonText}>📤 Поделиться рейтингом</Text>
      </TouchableOpacity>

      {/* Список рейтинга */}
      <FlatList
        data={ranking}
        renderItem={renderPlayer}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  shareButton: {
    backgroundColor: '#4CAF50',
    margin: 15,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  playerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  topPlayerCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#FFFACD',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  medal: {
    fontSize: 24,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  playerRating: {
    fontSize: 14,
    color: '#2196F3',
    marginTop: 2,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  matchesText: {
    fontSize: 12,
    color: '#666',
  },
  winRateText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  playerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  detailLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default RatingScreen;

