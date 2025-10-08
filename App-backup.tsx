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

const AuthenticatedApp = (): React.JSX.Element => {
  const {logout} = useAuth();
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
        {/* Заголовок */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🏆 Футбольный Рейтинг</Text>
        </View>
        
        {/* Навигационные кнопки */}
        <View style={styles.navContainer}>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'Home' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('Home')}>
            <Text style={[styles.navText, currentScreen === 'Home' && styles.activeNavText]}>🏠 Главная</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'Players' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('Players')}>
            <Text style={[styles.navText, currentScreen === 'Players' && styles.activeNavText]}>👥 Игроки</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'Matches' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('Matches')}>
            <Text style={[styles.navText, currentScreen === 'Matches' && styles.activeNavText]}>⚽ Матчи</Text>
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
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5'}}>
        <Text style={{fontSize: 18, color: '#666'}}>Загрузка...</Text>
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
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  navContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navButton: {
    flex: 1,
    padding: 10,
    margin: 2,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  activeNavButton: {
    backgroundColor: '#2196F3',
  },
  navText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  activeNavText: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
});

export default App;