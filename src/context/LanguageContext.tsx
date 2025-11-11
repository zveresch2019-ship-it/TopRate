import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const DEFAULT_LANGUAGE: Language = 'en';

// Переводы
const translations = {
  ru: {
    // Общие
    'app.title': 'ТопРейт',
    'app.language': 'Язык',
    'app.language.ru': 'Русский',
    'app.language.en': 'English',
    
    // Навигация
    'nav.home': 'Главная',
    'nav.players': 'Рейтинг',
    'nav.matches': 'Матчи',
    'nav.rating': 'Рейтинг',
    
    // Главная страница
    'home.welcome': 'Добро пожаловать',
    'home.players': 'Игроков',
    'home.matches': 'Матчей',
    'home.average_rating': 'Средний рейтинг',
    'home.top_players': 'Топ игроки',
    'home.export_pdf': 'Экспорт',
    'home.new_season': 'Новый сезон',
    'home.season': 'Сезон',
    
    // Игроки
    'players.title': 'Рейтинг',
    'players.add_player': 'Добавить игрока',
    'players.player_name': 'Имя игрока',
    'players.rating': 'Рейтинг',
    'players.matches': 'Матчей',
    'players.wins': 'Побед',
    'players.draws': 'Ничьих',
    'players.losses': 'Поражений',
    'players.goals_scored': 'Голов забито',
    'players.goals_conceded': 'Голов пропущено',
    'players.last_change': 'Последнее изменение',
    'players.rating': 'Рейтинг',
    'players.by_game': 'после игры',
    'players.new_player': 'Новый игрок',
    'players.name': 'Имя',
    'players.before': 'До',
    'players.change': '+/-',
    'players.after': 'После',
    'players.matches': 'Игры',
    'players.total': 'Всего',
    'players.no_players': 'Нет игроков',
    'players.matches_short': 'Игр',
    'players.initial_rating_placeholder': 'Рейтинг (1000-2000)',
    'players.season': 'Сезон',
    'players.rename_player': 'Переименовать игрока',
    'common.cancel': 'Отмена',
    'common.add': 'Добавить',
    'common.save': 'Сохранить',
    'common.ok': 'OK',
    
    // Матчи
    'matches.add_match': 'Добавить матч',
    'matches.calculation_params': 'Параметры расчета:',
    'matches.expected_difference': 'ES (Ожидаемая разница):',
    'matches.real_difference': 'RGD (Реальная разница):',
    'matches.goal_value': 'GV (Цена гола):',
    'matches.total_value': 'TV (Итоговая сумма):',
    'matches.team_a': 'Команда A',
    'matches.team_b': 'Команда B',
    'matches.score': 'Счет:',
    'matches.save_match': 'Сохранить матч',
    'matches.history': 'История матчей',
    'matches.no_matches': 'Нет сохраненных матчей',
    'matches.cancel': 'Отмена',
    'matches.cancel_match_button': 'Отменить матч',
    'matches.show_params': 'Показать параметры',
    'matches.hide_params': 'Скрыть параметры',
    
    // Сервисные сообщения
    'messages.add_players_for_params': 'Добавьте игроков в обе команды для расчета параметров',
    'messages.player_already_in_other_team': 'Игрок уже в другой команде',
    'messages.player_already_in_team': 'Игрок уже в этой команде',
    'messages.team_must_have_players': 'В каждой команде должен быть хотя бы один игрок',
    'messages.enter_valid_score': 'Введите корректный счет',
    'messages.match_saved_success': 'Матч сохранен!',
    'messages.match_save_error': 'Не удалось сохранить матч',
    'messages.cancel_already_done': 'Отмена уже произведена',
    'messages.cancel_already_done_message': 'Отмена последнего матча уже была произведена. Добавьте новый матч, чтобы снова получить возможность отмены.',
    'messages.cancel_last_match_title': 'Отменить последний матч',
    'messages.cancel_last_match_confirm': 'Вы уверены, что хотите отменить последний матч? Рейтинги игроков вернутся к значениям до этого матча.',
    'messages.match_cancelled_success': 'Матч отменен! Рейтинги восстановлены.',
    'messages.match_cancelled_error': 'Не удалось отменить матч.',
    'messages.player_added_success': 'Игрок добавлен!',
    'messages.player_exists_error': 'Игрок с таким именем уже существует. Выберите другое имя.',
    'messages.player_actions_title': 'Действия с игроком',
    'messages.player_actions_message': 'Выберите действие для игрока',
    'messages.delete_player_title': 'Удалить игрока',
    'messages.delete_player_confirm': 'Вы уверены, что хотите удалить игрока? Все его матчи также будут удалены.',
    'messages.player_renamed_success': 'Игрок переименован',
    'messages.new_season_confirm': 'Вы уверены, что хотите начать новый сезон? Статистика матчей будет обнулена, но рейтинги игроков сохранятся.',
    'messages.new_season_success': 'Новый сезон начат! Статистика матчей обнулена, рейтинги сохранены.',
    'messages.new_season_error': 'Не удалось начать новый сезон',
    'messages.pdf_error': 'Не удалось создать PDF файл',
    'messages.share_error': 'Не удалось поделиться данными',
    'messages.email_error': 'Не удалось открыть почтовое приложение',
    'messages.login_error': 'Неверное имя пользователя или пароль. Пожалуйста, зарегистрируйтесь сначала.',
    'messages.login_failed': 'Ошибка аутентификации. Пожалуйста, попробуйте снова.',
    'messages.welcome_title': 'Добро пожаловать! 👋',
    'messages.welcome_text': 'Начните с добавления игроков и проведения матчей для создания рейтинга.',
    'messages.debug_team_info': 'Отладка: Команда A: {homeCount} игроков, Команда B: {awayCount} игроков',
    'messages.available_players': 'Доступные игроки',
    'messages.players_count': 'игроков',
    'messages.rating_label': 'Рейтинг',
    'messages.wins_label': 'Побед',
    'messages.date_label': 'Дата',
    'messages.total_players_label': 'Всего игроков',
    
    // Справка
    'help.title': 'СИСТЕМА РЕЙТИНГА ТОПРЕЙТ',
    'help.purpose': 'Система предназначена для определения индивидуального уровня игроков в командных любительских играх (прежде всего футбол) при более-менее регулярных матчах с более-менее регулярным составом участников, но преимущественно разной разбивкой на команды.',
    'help.how_works': 'Как работает рейтинг:',
    'help.add_players': '• Введите любое количество игроков с именами и начальным рейтингом',
    'help.initial_rating': '• Начальный рейтинг можно задать как равный для всех - 1500 очков или сразу установить различие в диапазоне от 1000 до 2000',
    'help.rating_changes': '• После каждого матча рейтинг изменяется',
    'help.change_factors': '• Изменение зависит от ожидаемого результата (разницы в рейтингах между командами), фактического результата (разницы в голах) и цены гола, которая тем выше, чем меньше игроков',
    'help.seasons_title': 'Сезоны:',
    'help.seasons_stats': '• Статистика в виде сыгранных матчей, побед/поражений и общего изменения рейтинга копится внутри сезона',
    'help.new_season': '• С началом нового сезона статистика обнуляется, но рейтинг остается неизменным',
    'help.rating_change_only_matches': '• Поменять рейтинг можно только участвуя в матчах',
    'help.goal': 'Цель: Создать справедливую систему оценки игроков на основе их результатов в матчах.',
    'players.edit': 'Редактировать',
    'players.delete': 'Удалить',
    'players.rename_player': 'Переименовать игрока',
    'players.enter_new_name': 'Введите новое имя игрока (до 10 символов)',
    'players.cancel': 'Отмена',
    'players.save': 'Сохранить',
    'players.player_renamed': 'Игрок переименован',
    'players.player_deleted': 'Игрок удален',
    'players.player_added': 'Игрок добавлен',
    'players.player_exists': 'Игрок с таким именем уже существует',
    'players.enter_name': 'Введите имя игрока',
    
    // Матчи
    'matches.title': 'Матчи',
    'matches.add_match': 'Добавить матч',
    'matches.home_team': 'Команда A',
    'matches.away_team': 'Команда B',
    'matches.home_score': 'Счет A',
    'matches.away_score': 'Счет B',
    'matches.competition': 'Турнир',
    'matches.save_match': 'Сохранить матч',
    'matches.match_saved': 'Матч сохранен',
    'matches.match_cancelled': 'Матч отменен',
    'matches.cancel_match': 'Отменить последний матч',
    'matches.cancel_confirm': 'Вы уверены, что хотите отменить последний матч? Рейтинги игроков вернутся к значениям до этого матча.',
    'matches.cancel_button': 'Отменить матч',
    'matches.cancel_already_done': 'Отмена уже произведена',
    'matches.cancel_message': 'Отмена последнего матча уже была произведена. Добавьте новый матч, чтобы снова получить возможность отмены.',
    'matches.history': 'История матчей',
    'matches.players_count': 'игрок',
    'matches.players_count_2': 'игрока',
    'matches.players_count_5': 'игроков',
    'matches.delete_match': 'Отмена',
    
    // Рейтинг
    'rating.title': 'Рейтинг',
    'rating.position': 'Позиция',
    'rating.name': 'Имя',
    'rating.before': 'До',
    'rating.change': 'Изменение',
    'rating.current': 'Текущий',
    'rating.matches': 'Матчей',
    'rating.total': 'Всего',
    
    // Экспорт
    'export.title': 'Экспорт рейтинга',
    'export.choose_method': 'Выберите способ экспорта:',
    'export.share': 'Поделиться',
    'export.email': 'Отправить по email',
    'export.cancel': 'Отмена',
    'export.success': 'Матч отменен! Рейтинги восстановлены.',
    'export.error': 'Не удалось отменить матч.',
    'export.share_error': 'Не удалось поделиться данными',
    'export.email_error': 'Не удалось открыть почтовое приложение',
    
    // Статистика
    'stats.title': 'Статистика',
    'stats.date': 'Дата',
    'stats.players': 'Игроков',
    'stats.matches': 'Матчей',
    'stats.average_rating': 'Средний рейтинг',
    
    // Ошибки
    'error.invalid_score': 'Введите корректный счет',
    'error.match_save_failed': 'Не удалось сохранить матч',
    'error.player_save_failed': 'Не удалось сохранить игрока',
    'error.player_delete_failed': 'Не удалось удалить игрока',
    'error.player_edit_failed': 'Не удалось изменить игрока',
  },
  en: {
    // General
    'app.title': 'TopRate',
    'app.language': 'Language',
    'app.language.ru': 'Русский',
    'app.language.en': 'English',
    
    // Navigation
    'nav.home': 'Home',
    'nav.players': 'Rating',
    'nav.matches': 'Matches',
    'nav.rating': 'Rating',
    
    // Home page
    'home.welcome': 'Welcome',
    'home.players': 'Players',
    'home.matches': 'Matches',
    'home.average_rating': 'Average Rating',
    'home.top_players': 'Top Players',
    'home.export_pdf': 'Export',
    'home.new_season': 'New Season',
    'home.season': 'Season',
    
    // Players
    'players.title': 'Rating',
    'players.add_player': 'Add Player',
    'players.player_name': 'Player Name',
    'players.rating': 'Rating',
    'players.matches': 'Games',
    'players.wins': 'Wins',
    'players.draws': 'Draws',
    'players.losses': 'Losses',
    'players.goals_scored': 'Goals Scored',
    'players.goals_conceded': 'Goals Conceded',
    'players.last_change': 'Last Change',
    'players.rating': 'Rating',
    'players.by_game': 'after the game',
    'players.new_player': 'New Player',
    'players.name': 'Name',
    'players.before': 'Before',
    'players.change': '+/-',
    'players.after': 'After',
    'players.matches': 'Games',
    'players.total': 'Total',
    'players.no_players': 'No Players',
    'players.matches_short': 'GP',
    'players.initial_rating_placeholder': 'Rating (1000-2000)',
    'players.season': 'Season',
    'players.rename_player': 'Rename Player',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.save': 'Save',
    'common.ok': 'OK',
    
    // Matches
    'matches.add_match': 'Add Match',
    'matches.calculation_params': 'Calculation Parameters:',
    'matches.expected_difference': 'ES (Expected Difference):',
    'matches.real_difference': 'RGD (Real Difference):',
    'matches.goal_value': 'GV (Goal Value):',
    'matches.total_value': 'TV (Total Value):',
    'matches.team_a': 'Team A',
    'matches.team_b': 'Team B',
    'matches.score': 'Score:',
    'matches.save_match': 'Save Match',
    'matches.history': 'Match History',
    'matches.no_matches': 'No saved matches',
    'matches.cancel': 'Cancel',
    'matches.cancel_match_button': 'Cancel Match',
    'matches.show_params': 'Show Parameters',
    'matches.hide_params': 'Hide Parameters',
    
    // Service messages
    'messages.add_players_for_params': 'Add players to both teams to calculate parameters',
    'messages.player_already_in_other_team': 'Player is already in another team',
    'messages.player_already_in_team': 'Player is already in this team',
    'messages.team_must_have_players': 'Each team must have at least one player',
    'messages.enter_valid_score': 'Enter a valid score',
    'messages.match_saved_success': 'Match saved!',
    'messages.match_save_error': 'Failed to save match',
    'messages.cancel_already_done': 'Cancellation already performed',
    'messages.cancel_already_done_message': 'The last match has already been cancelled. Add a new match to be able to cancel again.',
    'messages.cancel_last_match_title': 'Cancel Last Match',
    'messages.cancel_last_match_confirm': 'Are you sure you want to cancel the last match? Player ratings will revert to values before this match.',
    'messages.match_cancelled_success': 'Match cancelled! Ratings restored.',
    'messages.match_cancelled_error': 'Failed to cancel match.',
    'messages.player_added_success': 'Player added!',
    'messages.player_exists_error': 'Player with this name already exists. Choose another name.',
    'messages.player_actions_title': 'Player Actions',
    'messages.player_actions_message': 'Choose action for player',
    'messages.delete_player_title': 'Delete Player',
    'messages.delete_player_confirm': 'Are you sure you want to delete this player? All their matches will also be deleted.',
    'messages.player_renamed_success': 'Player renamed',
    'messages.new_season_confirm': 'Are you sure you want to start a new season? Match statistics will be reset, but player ratings will be preserved.',
    'messages.new_season_success': 'New season started! Match statistics reset, ratings preserved.',
    'messages.new_season_error': 'Failed to start new season',
    'messages.pdf_error': 'Failed to create PDF file',
    'messages.share_error': 'Failed to share data',
    'messages.email_error': 'Failed to open email app',
    'messages.login_error': 'Invalid username or password. Please register first.',
    'messages.login_failed': 'Authentication failed. Please try again.',
    'messages.welcome_title': 'Welcome! 👋',
    'messages.welcome_text': 'Start by adding players and conducting matches to create a rating.',
    'messages.debug_team_info': 'Debug: Team A: {homeCount} players, Team B: {awayCount} players',
    'messages.available_players': 'Available Players',
    'messages.players_count': 'players',
    'messages.rating_label': 'Rating',
    'messages.wins_label': 'Wins',
    'messages.date_label': 'Date',
    'messages.total_players_label': 'Total Players',
    
    // Help
    'help.title': 'TOPRATE RATING SYSTEM',
    'help.purpose': 'The system is designed to determine the individual level of players in team amateur games (primarily football) with more or less regular matches with more or less regular participants, but predominantly different team divisions.',
    'help.how_works': 'How the rating works:',
    'help.add_players': '• Enter any number of players with names and initial rating',
    'help.initial_rating': '• Initial rating can be set equal for all - 1500 points or immediately establish differences in the range from 1000 to 2000',
    'help.rating_changes': '• After each match, the rating changes',
    'help.change_factors': '• Change depends on expected result (rating difference between teams), actual result (goal difference) and goal value, which is higher the fewer players',
    'help.seasons_title': 'Seasons:',
    'help.seasons_stats': '• Statistics in the form of matches played, wins/losses and total rating change accumulate within the season',
    'help.new_season': '• With the start of a new season, statistics are reset, but the rating remains unchanged',
    'help.rating_change_only_matches': '• Rating can only be changed by participating in matches',
    'help.goal': 'Goal: Create a fair system for evaluating players based on their match results.',
    'players.edit': 'Edit',
    'players.delete': 'Delete',
    'players.rename_player': 'Rename Player',
    'players.enter_new_name': 'Enter new player name (up to 10 characters)',
    'players.cancel': 'Cancel',
    'players.save': 'Save',
    'players.player_renamed': 'Player renamed',
    'players.player_deleted': 'Player deleted',
    'players.player_added': 'Player added',
    'players.player_exists': 'Player with this name already exists',
    'players.enter_name': 'Enter player name',
    
    // Matches
    'matches.title': 'Matches',
    'matches.add_match': 'Add Match',
    'matches.home_team': 'Team A',
    'matches.away_team': 'Team B',
    'matches.home_score': 'Score A',
    'matches.away_score': 'Score B',
    'matches.competition': 'Competition',
    'matches.save_match': 'Save Match',
    'matches.match_saved': 'Match saved',
    'matches.match_cancelled': 'Match cancelled',
    'matches.cancel_match': 'Cancel Last Match',
    'matches.cancel_confirm': 'Are you sure you want to cancel the last match? Player ratings will return to values before this match.',
    'matches.cancel_button': 'Cancel Match',
    'matches.cancel_already_done': 'Cancel already done',
    'matches.cancel_message': 'Last match cancellation has already been done. Add a new match to get cancellation option again.',
    'matches.history': 'Match History',
    'matches.players_count': 'player',
    'matches.players_count_2': 'players',
    'matches.players_count_5': 'players',
    'matches.delete_match': 'Delete',
    
    // Rating
    'rating.title': 'Rating',
    'rating.position': 'Position',
    'rating.name': 'Name',
    'rating.before': 'Before',
    'rating.change': 'Change',
    'rating.current': 'Current',
    'rating.matches': 'Matches',
    'rating.total': 'Total',
    
    // Export
    'export.title': 'Export Rating',
    'export.choose_method': 'Choose export method:',
    'export.share': 'Share',
    'export.email': 'Send by email',
    'export.cancel': 'Cancel',
    'export.success': 'Match cancelled! Ratings restored.',
    'export.error': 'Failed to cancel match.',
    'export.share_error': 'Failed to share data',
    'export.email_error': 'Failed to open email app',
    
    // Statistics
    'stats.title': 'Statistics',
    'stats.date': 'Date',
    'stats.players': 'Players',
    'stats.matches': 'Matches',
    'stats.average_rating': 'Average Rating',
    
    // Errors
    'error.invalid_score': 'Enter valid score',
    'error.match_save_failed': 'Failed to save match',
    'error.player_save_failed': 'Failed to save player',
    'error.player_delete_failed': 'Failed to delete player',
    'error.player_edit_failed': 'Failed to edit player',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  // Загружаем сохраненный язык
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('app_language');
        if (savedLanguage === 'en') {
          setLanguageState('en');
        } else {
          setLanguageState(DEFAULT_LANGUAGE);
          await AsyncStorage.setItem('app_language', DEFAULT_LANGUAGE);
        }
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };
    loadLanguage();
  }, []);

  // Сохраняем язык при изменении
  const setLanguage = async (lang: Language) => {
    try {
      const nextLanguage: Language = lang === 'en' ? 'en' : DEFAULT_LANGUAGE;
      setLanguageState(nextLanguage);
      await AsyncStorage.setItem('app_language', nextLanguage);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  // Функция перевода
  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
