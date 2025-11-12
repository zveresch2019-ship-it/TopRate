import React, {useState, useEffect} from 'react';
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
import {useSport} from '../context/SportContext';

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
    loadData,
  } = useRating();
  
  const {currentUser, logout, deleteAccount} = useAuth();
  const {language, setLanguage, t} = useLanguage();
  const {currentSport, setSport} = useSport();
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState<number | null>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState<boolean>(false);
  
  console.log('HomeScreen: currentUser =', currentUser);
  console.log('HomeScreen: currentUser?.username =', currentUser?.username);
  console.log('HomeScreen: DEBUG - Component is rendering');

  // Отслеживаем предыдущий вид спорта
  const prevSportRef = React.useRef<string | null>(null);
  const isFirstMountRef = React.useRef<boolean>(true);
  
  // Загружаем количество участников группы и проверяем, является ли пользователь админом группы
  useEffect(() => {
    const loadGroupInfo = async () => {
      if (currentUser?.groupId) {
        try {
          const { groupsAPI } = await import('../utils/api');
          const groupsResponse = await groupsAPI.getAll();
          const groups = groupsResponse.groups || [];
          
          // Ищем группу пользователя по groupId (может быть в формате id или _id)
          const userGroup = groups.find((g: any) => {
            const groupId = g.id || g._id;
            const userGroupId = currentUser.groupId;
            return groupId && userGroupId && groupId.toString() === userGroupId.toString();
          });
          
          if (userGroup) {
            setGroupMemberCount(userGroup.memberCount || 0);
            console.log('✅ Group member count loaded:', userGroup.memberCount);
            
            // Проверяем, является ли пользователь админом группы
            // Проверяем role пользователя (глобальный админ) или сравниваем с adminUsername группы
            const isAdmin = currentUser.role === 'admin' || 
                          (userGroup.adminUsername && 
                           userGroup.adminUsername.toLowerCase() === currentUser.username.toLowerCase());
            setIsGroupAdmin(isAdmin);
            console.log('✅ User is group admin?', isAdmin, 'adminUsername:', userGroup.adminUsername, 'currentUser:', currentUser.username);
          } else {
            console.log('⚠️ User group not found in groups list');
            setGroupMemberCount(null);
            setIsGroupAdmin(false);
          }
        } catch (error) {
          console.log('⚠️ Failed to load group info:', error);
          setGroupMemberCount(null);
          setIsGroupAdmin(false);
        }
      } else {
        setGroupMemberCount(null);
        setIsGroupAdmin(false);
      }
    };
    
    loadGroupInfo();
  }, [currentUser?.groupId, currentUser?.groupName, currentUser?.username, currentUser?.role]);
  
  // Перезагружаем данные при монтировании компонента или изменении вида спорта
  useEffect(() => {
    if (currentUser && loadData) {
      const sportChanged = prevSportRef.current !== currentSport;
      
      // Перезагружаем данные при первом монтировании или изменении вида спорта
      if (isFirstMountRef.current || sportChanged) {
        console.log('🔄 HomeScreen: Reloading data...');
        console.log('🔄 HomeScreen: First mount:', isFirstMountRef.current);
        console.log('🔄 HomeScreen: Previous sport:', prevSportRef.current);
        console.log('🔄 HomeScreen: Current sport:', currentSport);
        console.log('🔄 HomeScreen: Sport changed:', sportChanged);
        
        loadData();
        prevSportRef.current = currentSport || null;
        isFirstMountRef.current = false;
      }
    }
  }, [currentUser, currentSport, loadData]); // Перезагружаем только при изменении пользователя или вида спорта


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

  const handleAccountPress = () => {
    setIsAccountModalVisible(true);
  };

  const handleLogout = () => {
    console.log('HomeScreen: handleLogout called');
    setIsAccountModalVisible(false);
    console.log('HomeScreen: Modal closed, calling logout directly...');
    
    // Прямой выход без диалога для тестирования
    console.log('HomeScreen: logout button pressed');
    logout();
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      language === 'ru' ? 'Удалить аккаунт?' : 'Delete Account?',
      language === 'ru' 
        ? 'Все ваши данные (игроки, матчи, статистика) будут безвозвратно удалены. Это действие нельзя отменить.' 
        : 'All your data (players, matches, statistics) will be permanently deleted. This action cannot be undone.',
      [
        {
          text: language === 'ru' ? 'Отмена' : 'Cancel',
          style: 'cancel',
        },
        {
          text: language === 'ru' ? 'Удалить' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsAccountModalVisible(false);
            const success = await deleteAccount();
            if (success) {
              Alert.alert(
                language === 'ru' ? 'Аккаунт удален' : 'Account Deleted',
                language === 'ru' ? 'Ваш аккаунт и все данные успешно удалены.' : 'Your account and all data have been deleted successfully.'
              );
            }
          },
        },
      ]
    );
  };

  const createBeautifulTextTable = () => {
    const title = language === 'ru' ? '🏆 ТОПРЕЙТ - РЕЙТИНГ ИГРОКОВ' : '🏆 TOPRATE - PLAYER RATINGS';
    let text = `${title}\n\n`;
    
    if (currentSeason) {
      text += `📅 ${currentSeason.name}\n`;
      text += `📊 ${t('stats.players')}: ${totalPlayers}\n`;
      text += `⚽ ${t('stats.matches')}: ${totalMatches}\n`;
      text += `📈 ${t('home.average_rating')}: ${averageRating}\n\n`;
    }
    
    text += `🏆 ${t('home.top_players')}:\n\n`;
    
    ranking.forEach((player, index) => {
      const shortName = player.name.length > 10 ? player.name.slice(0, 10) : player.name;
      const changeSign = player.lastRatingChange > 0 ? '+' : '';
      const medal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
      text += `${medal}${index + 1}. ${shortName} — ${player.rating} (${t('players.matches_short')}: ${player.matchesPlayed}, ${t('players.change')}: ${changeSign}${player.lastRatingChange})\n`;
    });
    
    return text;
  };

  const generateMobilePDF = () => {
    const tableText = createBeautifulTextTable();
    
    Alert.alert(
      language === 'ru' ? 'Экспорт данных' : 'Export Data',
      language === 'ru' ? 'Выберите способ экспорта:' : 'Select export method:',
      [
        {text: language === 'ru' ? 'Отмена' : 'Cancel', style: 'cancel'},
        {
          text: language === 'ru' ? 'Поделиться' : 'Share',
          onPress: () => shareRatingData(tableText),
        },
        {
          text: language === 'ru' ? 'Отправить по email' : 'Send via Email',
          onPress: () => sendEmailRating(tableText),
        },
      ]
    );
  };

  const shareRatingData = async (text: string) => {
    try {
      await Share.share({
        message: text,
        title: language === 'ru' ? 'Рейтинг игроков ТопРейт' : 'TopRate Player Ratings',
      });
    } catch (error) {
      console.error('Ошибка при отправке:', error);
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' ? 'Не удалось отправить данные' : 'Failed to send data'
      );
    }
  };

  const sendEmailRating = async (text: string) => {
    try {
      const emailSubject = encodeURIComponent(
        language === 'ru' ? 'Рейтинг игроков ТопРейт' : 'TopRate Player Ratings'
      );
      // Сначала кодируем весь текст, затем заменяем закодированные переносы на правильные для email
      const encodedBody = encodeURIComponent(text);
      const emailBody = encodedBody.replace(/%0A/g, '%0D%0A');
      const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;
      
      await Linking.openURL(emailUrl);
    } catch (error) {
      console.error('Ошибка при открытии email:', error);
      Alert.alert(
        language === 'ru' ? 'Ошибка' : 'Error',
        language === 'ru' ? 'Не удалось открыть почтовый клиент' : 'Failed to open email client'
      );
    }
  };

  return (
    <View style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Заголовок */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.leftColumn}>
            <Text style={styles.title}>🏆 {t('app.title')}</Text>
            
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>{language === 'ru' ? 'Аккаунт:' : 'Account:'}</Text>
              <TouchableOpacity style={styles.accountInfo} onPress={handleAccountPress}>
                <Text style={styles.accountText}>
                  {currentUser?.username 
                    ? (currentUser.username.length > 8 ? currentUser.username.slice(0, 8) : currentUser.username)
                    : 'Гость'
                  }
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>{language === 'ru' ? 'Справка:' : 'Help:'}</Text>
              <TouchableOpacity 
                style={styles.helpButton} 
                onPress={() => setIsHelpModalVisible(true)}>
                <Text style={styles.helpButtonText}>?</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Sport:</Text>
              <TouchableOpacity 
                style={styles.languageButton} 
                onPress={() => setSport(currentSport === 'football' ? 'basketball' : 'football')}>
                <Text style={styles.languageButtonText}>
                  {currentSport === 'football' ? '⚽ FTBL' : '🏀 BSBL'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Group:</Text>
              <View style={styles.groupInfoContainer}>
                <Text style={styles.accountValue}>
                  {currentUser?.groupName || 'None'}
                </Text>
                {groupMemberCount !== null && (
                  <Text style={styles.groupMemberCount}>
                    ({groupMemberCount} {language === 'ru' ? 'участников' : 'members'})
                  </Text>
                )}
              </View>
            </View>
          </View>
          
          <View style={styles.rightColumn}>
            <Text style={styles.subtitle}>
              {language === 'ru' 
                ? 'Индивидуальный прогресс в командном спорте'
                : 'Individual progress in team sports'
              }
            </Text>
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
              </View>
            );
          })}
        </View>
      )}

      {/* Кнопки действий */}
      <View style={styles.buttonsContainer}>
        {/* Кнопка "New Season" всегда видна, но заблокирована для обычных пользователей */}
        <TouchableOpacity
          style={[styles.newSeasonButton, !isGroupAdmin && styles.disabledButton]}
          onPress={handleStartNewSeason}
          disabled={!isGroupAdmin}>
          <Text style={[styles.newSeasonButtonText, !isGroupAdmin && styles.disabledButtonText]}>
            🆕 {t('home.new_season')}
          </Text>
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
            <View style={styles.helpSectionWrapper}>
              {[t('help.main_tab'), t('help.ratings_tab'), t('help.matches_tab')]
                .filter(Boolean)
                .map((item, index) => (
                  <Text key={`help-main-${index}`} style={styles.helpText}>{item}</Text>
                ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  
  {/* Модальное окно аккаунта: Logout / Delete */}
  <Modal
    visible={isAccountModalVisible}
    transparent={true}
    animationType="fade"
    onRequestClose={() => setIsAccountModalVisible(false)}>
    <View style={styles.modalOverlay}>
      <View style={styles.helpModalContent}>
        <View style={styles.helpModalHeader}>
          <Text style={styles.helpModalTitle}>{language === 'ru' ? 'Аккаунт' : 'Account'}</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setIsAccountModalVisible(false)}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 12, alignItems: 'stretch' }}>
          <TouchableOpacity style={[styles.languageButton, { backgroundColor: '#0051D5', width: '100%' }]} onPress={handleLogout}>
            <Text style={styles.languageButtonText}>{language === 'ru' ? 'Выйти' : 'Sign Out'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.languageButton, { backgroundColor: '#FF3B30', width: '100%' }]} onPress={handleDeleteAccount}>
            <Text style={styles.languageButtonText}>{language === 'ru' ? 'Удалить аккаунт' : 'Delete Account'}</Text>
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
    backgroundColor: '#F5F6FA', // tokens: color.surface
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
    backgroundColor: '#FF9500',
    paddingTop: 8,
    paddingBottom: 10,
    paddingLeft: 20,
    paddingRight: 4,
    shadowColor: '#1B2940',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftColumn: {
    width: '60%',
    marginLeft: -8,
  },
  rightColumn: {
    width: '40%',
    paddingLeft: 4,
    paddingTop: 6,
    justifyContent: 'flex-start',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  accountLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    marginRight: 8,
    width: 100,
  },
  helpButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    width: 130,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0, 0, 0, 0.4)',
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  languageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    width: 130,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0, 0, 0, 0.4)',
  },
  languageButtonText: {
    color: '#FFFFFF', // tokens: color.onPrimary
    fontSize: 13,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 14,
    textAlign: 'left',
  },
  accountInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    width: 130,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0, 0, 0, 0.4)',
  },
  accountText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  accountValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  groupInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  groupMemberCount: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  seasonContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16, // tokens: spacing.md
    marginTop: 4, // увеличен с -10 для сдвига вниз
    paddingVertical: 8, // уменьшен с 12
    paddingHorizontal: 16,
    borderRadius: 20, // уменьшен с 24
    shadowColor: '#1B2940', // tokens: color.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // tokens: shadowStyle.soft
    shadowRadius: 8,
    elevation: 2,
  },
  seasonText: {
    fontSize: 17,
    fontWeight: '600', // tokens: typography.title medium
    color: '#0051D5', // tokens: color.primary
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10, // уменьшен с 12
    marginHorizontal: 16,
    marginTop: 6, // уменьшен с 8
    backgroundColor: '#FFFFFF',
    borderRadius: 20, // уменьшен с 24
    shadowColor: '#1B2940',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  statCard: {
    alignItems: 'center',
    padding: 6, // уменьшен с 8
  },
  statNumber: {
    fontSize: 22, // tokens: typography.headline (larger for emphasis)
    fontWeight: 'bold',
    color: '#0051D5', // tokens: color.primary
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11, // уменьшен для длинных надписей
    color: '#355C7D', // tokens: color.inkSecondary
    textAlign: 'center',
  },
  topPlayersContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16, // tokens: spacing.md
    borderRadius: 24, // tokens: radii.lg
    padding: 16, // tokens: spacing.md
    shadowColor: '#1B2940', // tokens: color.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // tokens: shadowStyle.soft
    shadowRadius: 8,
    elevation: 2,
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
    color: '#0051D5', // tokens: color.primary
    fontWeight: 'bold',
  },
  topCellName: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#355C7D', // tokens: color.inkSecondary
  },
  topCellRating: {
    width: 65, // расширено для 4 знаков
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#0051D5', // tokens: color.primary (акцент на рейтинге)
  },
  sectionTitle: {
    fontSize: 17, // tokens: typography.title
    fontWeight: 'bold',
    color: '#355C7D', // tokens: color.inkSecondary
    marginBottom: 12, // tokens: spacing.sm
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
    marginTop: -10, // Поднимаем кнопки выше (увеличено с -8)
    marginHorizontal: 16,
    marginBottom: 4,
    gap: 2, // уменьшен с 3
  },
  newSeasonButton: {
    backgroundColor: '#FF9500', // оранжевый акцент
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 6, // уменьшен с 8
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
  },
  newSeasonButtonText: {
    color: '#FFFFFF', // tokens: color.onPrimary
    fontSize: 16, // tokens: typography.body
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC', // серый цвет для заблокированной кнопки
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999999', // темно-серый текст для заблокированной кнопки
  },
  pdfButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 4, // уменьшен с 6
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
  pdfButtonText: {
    color: '#FFFFFF', // белый на оранжевом
    fontSize: 16,
    fontWeight: 'bold',
  },
  welcomeContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16, // tokens: spacing.md
    padding: 24, // tokens: spacing.lg (card.padding)
    borderRadius: 24, // tokens: radii.lg
    alignItems: 'center',
    shadowColor: '#1B2940', // tokens: color.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // tokens: shadowStyle.soft
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeTitle: {
    fontSize: 22, // tokens: typography.headline
    fontWeight: 'bold',
    color: '#0051D5', // tokens: color.primary
    marginBottom: 12, // tokens: spacing.sm
  },
  welcomeText: {
    fontSize: 16, // tokens: typography.body
    color: '#355C7D', // tokens: color.inkSecondary
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Стили для модального окна справки
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24, // tokens: radii.lg
    padding: 24, // tokens: spacing.lg
    margin: 24,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#1B2940', // tokens: color.shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // tokens: shadowStyle.soft
    shadowRadius: 8,
    elevation: 5,
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
    fontSize: 22, // tokens: typography.headline
    fontWeight: 'bold',
    color: '#0051D5', // tokens: color.primary
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#0051D5', // tokens: color.primary
    borderRadius: 20, // tokens: radii.full (pill)
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF', // tokens: color.onPrimary
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpModalBody: {
    maxHeight: 400,
  },
  helpPurpose: {
    fontSize: 15,
    color: '#1B2940',
    lineHeight: 22,
    marginBottom: 12,
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0051D5',
    marginTop: 16,
    marginBottom: 8,
  },
  helpSectionWrapper: {
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#1B2940',
    marginBottom: 6,
    lineHeight: 20,
    opacity: 0.95,
  },
  helpGoal: {
    fontSize: 14,
    color: '#1B2940',
    marginTop: 12,
    lineHeight: 20,
    fontWeight: '600',
  },
});

export default HomeScreen;
