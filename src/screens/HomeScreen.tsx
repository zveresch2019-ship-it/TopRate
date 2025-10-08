import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Share,
  Linking,
  Modal,
} from 'react-native';
import {useRating} from '../context/RatingContext';
import {useAuth} from '../context/AuthContext';
import {useLanguage} from '../context/LanguageContext';

interface HomeScreenProps {
  navigation?: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const {
    players,
    getTotalMatches,
    getAverageRating,
    getPlayersByRating,
    currentSeason,
    seasons,
    getSeasonMatches,
    startNewSeason,
  } = useRating();
  
  const {currentUser, logout} = useAuth();
  const {language, setLanguage, t} = useLanguage();
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  
  console.log('HomeScreen: currentUser =', currentUser);
  console.log('HomeScreen: currentUser?.username =', currentUser?.username);


  const totalPlayers = players.length;
  const totalMatches = getTotalMatches();
  const averageRating = getAverageRating();
  const ranking = getPlayersByRating();
  
        // Отладочная информация - FORCE UPDATE 3
        console.log('HomeScreen: ranking data FORCE UPDATE 3:', ranking.map(p => ({
          name: p.name,
          rating: p.rating,
          lastRatingChange: p.lastRatingChange,
          totalRatingGain: p.totalRatingGain
        })));
  


  const handleStartNewSeason = async () => {
    console.log('HomeScreen: handleStartNewSeason called');
    console.log('HomeScreen: startNewSeason function:', startNewSeason);

    Alert.alert(
      t('messages.new_season_confirm'),
      t('messages.new_season_success'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('home.new_season'),
          onPress: async () => {
            console.log('HomeScreen: Starting new season...');
            try {
              const result = await startNewSeason();
              console.log('HomeScreen: startNewSeason result:', result);
              Alert.alert(t('messages.new_season_success'));
            } catch (error) {
              console.error('Ошибка при создании нового сезона:', error);
              Alert.alert(t('common.error'), t('messages.new_season_error'));
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const createBeautifulTextTable = () => {
    let text = '🏆 ТОПРЕЙТ - РЕЙТИНГ ИГРОКОВ\n\n';
    
    if (currentSeason) {
      text += `📅 ${currentSeason.name}\n`;
      text += `📊 ${t('stats.players')}: ${totalPlayers}\n`;
      text += `⚽ ${t('stats.matches')}: ${totalMatches}\n`;
      text += `📈 ${t('home.average_rating')}: ${averageRating}\n\n`;
    }
    
    text += `🏆 ${t('home.top_players')}:\n`;
    
    ranking.slice(0, 10).forEach((player, index) => {
      const shortName = player.name.length > 10 ? player.name.slice(0, 10) : player.name;
      const changeSign = player.lastRatingChange > 0 ? '+' : '';
      const totalSign = (player.totalRatingGain ?? 0) > 0 ? '+' : '';
      const medal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
      text += `${medal}${index + 1}. ${shortName} — ${player.rating} (${t('players.matches_short')}: ${player.matchesPlayed}, ${t('players.change')}: ${changeSign}${player.lastRatingChange})\n`;
    });
    
    return text;
  };

  const generateMobilePDF = () => {
    const tableText = createBeautifulTextTable();
    
    Alert.alert(
      'Экспорт данных',
      'Выберите способ экспорта:',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Поделиться',
          onPress: () => shareRatingData(tableText),
        },
        {
          text: 'Отправить по email',
          onPress: () => sendEmailRating(tableText),
        },
      ]
    );
  };

  const shareRatingData = async (text: string) => {
    try {
      await Share.share({
        message: text,
        title: 'Рейтинг игроков ТопРейт',
      });
    } catch (error) {
      console.error('Ошибка при отправке:', error);
      Alert.alert('Ошибка', 'Не удалось отправить данные');
    }
  };

  const sendEmailRating = async (text: string) => {
    try {
      const emailBody = encodeURIComponent(text);
      const emailSubject = encodeURIComponent('Рейтинг игроков ТопРейт');
      const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;
      
      await Linking.openURL(emailUrl);
    } catch (error) {
      console.error('Ошибка при открытии email:', error);
      Alert.alert('Ошибка', 'Не удалось открыть почтовый клиент');
    }
  };

  return (
    <View style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.title}>🏆 {t('app.title')}</Text>
            <Text style={styles.subtitle}>
              {language === 'ru' 
                ? 'Индивидуальный прогресс\nв командном спорте'
                : 'Individual progress\nin team sports'
              }
            </Text>
          </View>
            <View style={styles.accountContainer}>
              <TouchableOpacity style={styles.accountInfo} onPress={handleLogout}>
                <Text style={styles.accountText}>👤 {currentUser?.username || 'Гость'}</Text>
              </TouchableOpacity>
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  style={styles.helpButton} 
                  onPress={() => setIsHelpModalVisible(true)}>
                  <Text style={styles.helpButtonText}>❓</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.languageButton} 
                  onPress={() => setLanguage(language === 'ru' ? 'en' : 'ru')}>
                  <Text style={styles.languageButtonText}>
                    {language === 'ru' ? 'EN' : 'RU'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
        </View>
      </View>

      {/* Индикатор сезона */}
      {currentSeason && (
        <View style={styles.seasonContainer}>
          <Text style={styles.seasonText}>
            {t('home.season')} {currentSeason.number}
          </Text>
        </View>
      )}

      {/* Статистика */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalPlayers}</Text>
          <Text style={styles.statLabel}>{t('home.players')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalMatches}</Text>
          <Text style={styles.statLabel}>{t('home.matches')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{averageRating}</Text>
          <Text style={styles.statLabel}>{t('home.average_rating')}</Text>
        </View>
      </View>

      {/* Топ игроки */}
          {ranking.length > 0 && (
        <View style={styles.topPlayersContainer}>
          <Text style={styles.sectionTitle}>🏆 {t('home.top_players')}</Text>
          {ranking.slice(0, 3).map((player, index) => {
            const shortName = player.name.length > 10 ? player.name.slice(0, 10) : player.name;
            return (
              <View key={`${player.id}-${index}`} style={styles.topPlayerRow}>
                <Text style={styles.topCellRank}>{index + 1}</Text>
                <Text style={styles.topCellName}>{shortName}</Text>
                <Text style={styles.topCellRating}>{player.rating}</Text>
                <Text style={styles.topCellGames}>{player.matchesPlayed}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Кнопки действий */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.newSeasonButton}
          onPress={handleStartNewSeason}>
          <Text style={styles.newSeasonButtonText}>🆕 {t('home.new_season')}</Text>
        </TouchableOpacity>
        

        {ranking.length > 0 && (
          <TouchableOpacity
            style={styles.pdfButton}
            onPress={generateMobilePDF}>
            <Text style={styles.pdfButtonText}>📄 {t('home.export_pdf')}</Text>
          </TouchableOpacity>
        )}


      </View>

      {/* Приветственное сообщение */}
      {totalPlayers === 0 && (
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>{t('messages.welcome_title')}</Text>
          <Text style={styles.welcomeText}>
            {t('messages.welcome_text')}
          </Text>
        </View>
      )}

    </ScrollView>

    {/* Модальное окно справки */}
    <Modal
      visible={isHelpModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setIsHelpModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.helpModalContent}>
          <View style={styles.helpModalHeader}>
            <Text style={styles.helpModalTitle}>{t('help.title')}</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setIsHelpModalVisible(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.helpModalBody} showsVerticalScrollIndicator={true}>
            <Text style={styles.helpPurpose}>{t('help.purpose')}</Text>
            
            <Text style={styles.helpSectionTitle}>{t('help.how_works')}</Text>
            <Text style={styles.helpText}>{t('help.add_players')}</Text>
            <Text style={styles.helpText}>{t('help.initial_rating')}</Text>
            <Text style={styles.helpText}>{t('help.rating_changes')}</Text>
            <Text style={styles.helpText}>{t('help.change_factors')}</Text>
            
            <Text style={styles.helpSectionTitle}>{t('help.seasons_title')}</Text>
            <Text style={styles.helpText}>{t('help.seasons_stats')}</Text>
            <Text style={styles.helpText}>{t('help.new_season')}</Text>
            <Text style={styles.helpText}>{t('help.rating_change_only_matches')}</Text>
            
            <Text style={styles.helpGoal}>{t('help.goal')}</Text>
          </ScrollView>
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
  navContainer: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeNavButton: {
    backgroundColor: '#1976D2',
  },
  navText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activeNavText: {
    color: '#ffffff',
  },
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 0,
    paddingBottom: 20,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  accountContainer: {
    alignItems: 'flex-end',
    flexDirection: 'column',
    gap: 5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  helpButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
  helpButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  languageButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-end',
  },
  languageButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#E3F2FD',
    lineHeight: 18,
  },
  accountInfo: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  accountText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  seasonContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 15,
    marginTop: -10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  seasonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
    marginHorizontal: 12,
    marginTop: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statCard: {
    alignItems: 'center',
    padding: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  topPlayersContainer: {
    backgroundColor: '#ffffff',
    margin: 10,
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  topPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topCellRank: {
    width: 24,
    textAlign: 'center',
    color: '#2196F3',
    fontWeight: 'bold',
  },
  topCellName: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#333',
  },
  topCellRating: {
    width: 50,
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
  },
  topCellGames: {
    width: 40,
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  topPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  playerRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    width: 30,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  playerRating: {
    fontSize: 12,
    color: '#666',
  },
  ratingChanges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  ratingChange: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  seasonChange: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  buttonsContainer: {
    margin: 6,
    gap: 4,
  },
  newSeasonButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  newSeasonButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pdfButton: {
    backgroundColor: '#FF9800',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  pdfButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  welcomeContainer: {
    backgroundColor: '#ffffff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Стили для модального окна справки
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 10,
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#f44336',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpModalBody: {
    maxHeight: 400,
  },
  helpPurpose: {
    fontSize: 14,
    color: '#333',
    marginBottom: 15,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 15,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  helpGoal: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default HomeScreen;
