import React, {useState} from 'react';
import {Text, View, TouchableOpacity, StyleSheet} from 'react-native';
import {StatusBar} from 'expo-status-bar';

// Импорт экранов
import HomeScreen from './src/screens/HomeScreen';
import PlayersScreen from './src/screens/PlayersScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import LoginScreen from './src/screens/LoginScreen';

// Импорт контекста
import {RatingProvider} from './src/context/RatingContext';
import {AuthProvider, useAuth} from './src/context/AuthContext';
import {LanguageProvider, useLanguage} from './src/context/LanguageContext';

const AuthenticatedApp = (): React.JSX.Element => {
  const {logout} = useAuth();
  const {t} = useLanguage();
  const [currentScreen, setCurrentScreen] = useState('Home');

  console.log('AuthenticatedApp: rendering');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen />;
      case 'Players':
        return <PlayersScreen />;
      case 'Matches':
        return <MatchesScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <RatingProvider>
      <View style={styles.container}>
        {/* Навигационные кнопки */}
        <View style={styles.navContainer}>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'Home' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('Home')}>
            <Text style={[styles.navText, currentScreen === 'Home' && styles.activeNavText]} numberOfLines={1}>🏠 {t('nav.home')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'Players' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('Players')}>
            <Text style={[styles.navText, currentScreen === 'Players' && styles.activeNavText]} numberOfLines={1}>👥 {t('nav.players')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'Matches' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('Matches')}>
            <Text style={[styles.navText, currentScreen === 'Matches' && styles.activeNavText]} numberOfLines={1}>⚽ {t('nav.matches')}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Содержимое экрана */}
        <View style={styles.content}>
          {renderScreen()}
        </View>
      </View>
    </RatingProvider>
  );
};

const MainApp = (): React.JSX.Element => {
  const {currentUser, isLoading} = useAuth();
  
  console.log('MainApp: currentUser =', currentUser);
  console.log('MainApp: isLoading =', isLoading);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
};

const App = (): React.JSX.Element => {
  return (
    <>
      <StatusBar style="light" />
      <LanguageProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </LanguageProvider>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  navContainer: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 10,
    paddingHorizontal: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  navButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 1,
    minHeight: 40,
  },
  activeNavButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  navText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  activeNavText: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});

export default App;