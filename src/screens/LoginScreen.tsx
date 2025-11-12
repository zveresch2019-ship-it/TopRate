import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getAuthToken, authAPI } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

type ScreenMode = 'select' | 'login' | 'register';

const LoginScreen: React.FC<{
  onRegister?: (username: string, password: string) => void;
  onLogin?: () => void;
}> = ({ onRegister, onLogin }) => {
  const [mode, setMode] = useState<ScreenMode>('select');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, currentUser } = useAuth();
  const { t } = useLanguage();

  const helpSections = useMemo(() => {
    const howWorksItems = [
      t('help.add_players'),
      t('help.initial_rating'),
      t('help.rating_changes'),
      t('help.change_factors'),
    ].filter(Boolean);

    const extraItems = [t('help.rating_change_only_matches')].filter(Boolean);

    const sections: Array<{ title?: string; items: string[] }> = [];
    if (howWorksItems.length > 0) {
      sections.push({ title: t('help.how_works'), items: howWorksItems });
    }
    if (extraItems.length > 0) {
      const extraTitle = t('help.seasons_title');
      sections.push({ title: extraTitle || undefined, items: extraItems });
    }
    return sections;
  }, [t]);

  // Clear form when switching modes
  React.useEffect(() => {
    setUsername('');
    setPassword('');
  }, [mode]);

  // Clear mode when user logs in successfully
  React.useEffect(() => {
    if (currentUser) {
      setMode('select');
      setUsername('');
      setPassword('');
    }
  }, [currentUser]);

  const handleModeSelect = (selectedMode: 'login' | 'register') => {
    setMode(selectedMode);
    if (onLogin && selectedMode === 'login') {
      onLogin();
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'register') {
        // Registration
        console.log('LoginScreen: Registering user:', username);
        
        // Устанавливаем pendingRegistration СРАЗУ, чтобы избежать race condition
        // Если регистрация успешна, это состояние уже будет установлено
        // Если регистрация не успешна, onRegister не вызовется, и состояние не нужно
        let registrationPending = false;
        
        try {
          // Устанавливаем pendingRegistration ДО вызова register, чтобы App.tsx
          // не выполнил logout проверку до того, как мы установим pendingRegistration
          if (onRegister) {
            // Временно устанавливаем pendingRegistration через onRegister
            // Это предотвратит logout проверку в App.tsx
            onRegister(username, password);
            registrationPending = true;
          }
          
          const success = await register(username, password);
          console.log('LoginScreen: Register result:', success);

          if (success) {
            // Registration successful - proceed to group selection
            // onRegister уже вызван выше, pendingRegistration уже установлен
            console.log('LoginScreen: Registration successful, proceeding to group selection');
            setUsername('');
            setPassword('');
            setMode('select');
          } else {
            // Если регистрация не успешна, нужно сбросить pendingRegistration
            // Но мы не можем этого сделать напрямую из LoginScreen
            // Это обработается в App.tsx через проверку currentUser
            if (registrationPending) {
              console.log('LoginScreen: Registration failed, but pendingRegistration was set - it will be cleared by App.tsx');
            }
            // Registration returned false - это может быть "username already taken" ИЛИ ошибка валидации с уже исправленными данными
            // В случае ошибки валидации с исправленными данными не показываем Alert, т.к. данные уже валидны
            // Проверяем, валидны ли текущие данные
            const isCurrentUsernameValid = username.trim().length >= 3 && username.trim().length <= 8;
            const isCurrentPasswordValid = password.trim().length >= 6;
            
            // Если данные валидны, но регистрация вернула false, возможно это была ошибка валидации
            // которая уже обработана - не показываем ошибку, просто пробуем еще раз или логиним
            if (isCurrentUsernameValid && isCurrentPasswordValid) {
              // Данные валидны, но регистрация не прошла - возможно это "username already taken"
              // Попробуем автоматически залогинить
              console.log('LoginScreen: Registration returned false but data is valid, attempting auto-login');
            } else {
              // Данные не валидны, но регистрация вернула false - это странно
              // Показываем Alert с ошибкой валидации
              console.log('LoginScreen: Registration returned false and data is invalid, showing validation error');
              let validationErrors = [];
              if (!isCurrentUsernameValid) {
                validationErrors.push('Имя пользователя должно быть от 3 до 8 символов');
              }
              if (!isCurrentPasswordValid) {
                validationErrors.push('Пароль должен быть минимум 6 символов');
              }
              if (validationErrors.length > 0) {
                Alert.alert(
                  'Validation Error',
                  validationErrors.join('\n')
                );
                setIsLoading(false);
                return;
              }
            }
            
            // Registration returned false - это означает "username already taken" или другая ошибка
            // Попробуем автоматически залогинить
            console.log('LoginScreen: Registration returned false, attempting auto-login');
            
            try {
              // Пытаемся залогинить пользователя - это нормальная ситуация
              const loginSuccess = await login(username, password);
              
              if (loginSuccess) {
                // Успешный логин - проверяем, есть ли группа
                await new Promise(resolve => setTimeout(resolve, 400)); // Даем время обновиться currentUser
                
                const userData = await authAPI.getCurrentUser();
                
                if (userData && userData.user) {
                  if (userData.user.groupId) {
                    // У пользователя есть группа - успешный вход
                    console.log('LoginScreen: User has group, auto-login successful');
                    setUsername('');
                    setPassword('');
                    setMode('select');
                    return;
                  } else {
                    // У пользователя нет группы - переходим на выбор группы
                    console.log('LoginScreen: User exists but has no group, proceeding to group selection');
                    if (onRegister) {
                      onRegister(username, password);
                    }
                    setUsername('');
                    setPassword('');
                    setMode('select');
                    return;
                  }
                } else {
                  // Не удалось загрузить данные пользователя
                  console.log('LoginScreen: Failed to load user data after auto-login');
                }
              }
            } catch (loginError: any) {
              // Не логируем как ошибку - это нормальная ситуация (неверный пароль и т.д.)
              const errorMsg = (loginError?.message || '').toLowerCase();
              if (errorMsg.includes('invalid credentials')) {
                console.log('LoginScreen: Auto-login failed - invalid credentials (expected)');
              } else {
                console.log('LoginScreen: Auto-login failed:', loginError?.message || 'Unknown error');
              }
            }
            
            // Если автоматический логин не удался - предлагаем переключиться на Log In
            Alert.alert(
              'User Already Exists',
              'This username is already taken. Please use "Log In" to sign in with your existing account.',
              [
                {
                  text: 'Switch to Log In',
                  onPress: () => {
                    setMode('login');
                    setUsername(username); // Keep username
                  },
                },
                {
                  text: 'OK',
                  style: 'cancel',
                },
              ]
            );
          }
        } catch (registrationError: any) {
          // Этот блок catch обрабатывает все ошибки регистрации
          
          const errorMsg = registrationError?.message || '';
          console.log('LoginScreen: Caught registration error:', errorMsg);
          
          // Сначала проверяем, это ошибка валидации?
          const isValidationError = errorMsg.toLowerCase().includes('должно быть от 3 до 8') ||
                                   errorMsg.toLowerCase().includes('must be 3-8 characters') ||
                                   errorMsg.toLowerCase().includes('должен быть минимум 6') ||
                                   errorMsg.toLowerCase().includes('must be at least 6') ||
                                   errorMsg.toLowerCase().includes('validation error') ||
                                   errorMsg.toLowerCase().includes('обязательно') ||
                                   errorMsg.toLowerCase().includes('required');
          
          console.log('LoginScreen: Is validation error?', isValidationError);
          
          // Для ошибок валидации проверяем текущие данные
          if (isValidationError) {
            // Проверяем валидность текущих значений
            const isCurrentUsernameValid = username.trim().length >= 3 && username.trim().length <= 8;
            const isCurrentPasswordValid = password.trim().length >= 6;
            
            console.log('LoginScreen: Current username valid?', isCurrentUsernameValid, 'length:', username.trim().length);
            console.log('LoginScreen: Current password valid?', isCurrentPasswordValid, 'length:', password.trim().length);
            
            // Определяем тип ошибки
            const usernameError = errorMsg.toLowerCase().includes('имя') || 
                                 errorMsg.toLowerCase().includes('username') ||
                                 errorMsg.toLowerCase().includes('3-8') ||
                                 errorMsg.toLowerCase().includes('от 3 до 8');
            const passwordError = errorMsg.toLowerCase().includes('пароль') || 
                                 errorMsg.toLowerCase().includes('password') ||
                                 errorMsg.toLowerCase().includes('at least 6') ||
                                 errorMsg.toLowerCase().includes('минимум 6');
            
            console.log('LoginScreen: Username error?', usernameError);
            console.log('LoginScreen: Password error?', passwordError);
            
            // Если проблема исправлена, НЕ показываем ошибку
            const problemFixed = (usernameError && isCurrentUsernameValid && !passwordError) ||
                                (passwordError && isCurrentPasswordValid && !usernameError) ||
                                (usernameError && isCurrentUsernameValid && passwordError && isCurrentPasswordValid);
            
            console.log('LoginScreen: Problem fixed?', problemFixed);
            
            if (problemFixed) {
              // Проблема исправлена - не показываем ошибку
              console.log('LoginScreen: Validation error but issue is fixed, ignoring error');
            } else {
              // Проблема НЕ исправлена - ВСЕГДА показываем Alert
              console.log('LoginScreen: Validation error (showing Alert):', errorMsg);
              Alert.alert(
                'Validation Error',
                errorMsg || 'Please check your input.'
              );
              // После показа Alert завершаем обработку - не логируем как ошибку
              setIsLoading(false);
              return;
            }
          } else {
            // Для других ошибок (не валидация) - проверяем, зарегистрирован ли пользователь
            // Даем время на обновление currentUser и токена после успешной регистрации
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check if user is actually registered (token might have been saved)
            const token = await getAuthToken();
            const userData = await authAPI.getCurrentUser().catch(() => null);
            const isUserRegistered = token || 
                                    (currentUser && currentUser.username.toLowerCase() === username.toLowerCase()) ||
                                    (userData && userData.user && userData.user.username.toLowerCase() === username.toLowerCase());

            if (isUserRegistered) {
              // User registered successfully despite error - не показываем ошибку
              console.log('LoginScreen: User registered successfully despite error, skipping error display');
              if (onRegister) {
                onRegister(username, password);
              }
              setUsername('');
              setPassword('');
              setMode('select');
              setIsLoading(false);
              return;
            } else {
              // Пользователь не зарегистрирован - показываем ошибку
              console.log('LoginScreen: Registration error caught:', registrationError?.message || registrationError);
              Alert.alert(
                'Registration Failed',
                errorMsg || 'Failed to register user. Please try again.'
              );
            }
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        // Login
        console.log('LoginScreen: Attempting login for:', username);

        try {
          const success = await login(username, password);
          console.log('LoginScreen: Login result:', success);

          // Check if user is actually logged in
          await new Promise(resolve => setTimeout(resolve, 200));
          const token = await getAuthToken();
          const isUserLoggedIn = token || (currentUser && currentUser.username.toLowerCase() === username.toLowerCase());

          if (success || isUserLoggedIn) {
            // Successful login
            console.log('LoginScreen: Login successful');
            setUsername('');
            setPassword('');
            setMode('select');
          } else {
            // Login failed
            Alert.alert(
              'Login Failed',
              'Invalid username or password. Please check your credentials and try again.'
            );
          }
        } catch (loginError: any) {
          // Логируем ошибки входа только если это не ожидаемая ошибка (invalid credentials)
          const isExpectedError = (loginError?.message || '').toLowerCase().includes('invalid credentials');
          if (!isExpectedError) {
            console.error('LoginScreen: Login error caught:', loginError);
          } else {
            console.log('LoginScreen: Invalid credentials (expected error)');
          }

          // Check if user is actually logged in
          await new Promise(resolve => setTimeout(resolve, 200));
          const token = await getAuthToken();
          const isUserLoggedIn = token || (currentUser && currentUser.username.toLowerCase() === username.toLowerCase());

          if (isUserLoggedIn) {
            // User logged in successfully despite error
            console.log('LoginScreen: User logged in successfully despite error');
            setUsername('');
            setPassword('');
            setMode('select');
          } else {
            // Login failed
            const errorMsg = (loginError?.message || '').toLowerCase();
            if (errorMsg.includes('invalid credentials')) {
              Alert.alert(
                'Login Failed',
                'Invalid username or password. Please check your credentials and try again.'
              );
            } else {
              Alert.alert(
                'Login Failed',
                loginError?.message || 'Failed to login. Please try again.'
              );
            }
          }
        }
      }
    } catch (error: any) {
      console.error('LoginScreen: Unexpected error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const helpTextString = useMemo(() => {
    const lines = [
      t('help.purpose'),
      t('help.add_players'),
      t('help.initial_rating'),
      t('help.rating_changes'),
      t('help.change_factors'),
    ].filter(Boolean);
    return lines.join('\n');
  }, [t]);

  const renderHelp = () => (
    <View style={styles.helpContainer}>
      <View style={styles.helpScroll}>
        <View style={styles.helpScrollContent}>
          <Text style={styles.helpText}>{helpTextString}</Text>
        </View>
      </View>
    </View>
  );

  // Mode selection screen
  if (mode === 'select') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>🏆 TopRate</Text>
            {renderHelp()}
            <View style={styles.modeSelectionContainer}>
              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => handleModeSelect('login')}
              >
                <Text style={styles.modeButtonText}>Log In</Text>
                <Text style={styles.modeButtonSubtext}>For existing users</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => handleModeSelect('register')}
              >
                <Text style={styles.modeButtonText}>New User</Text>
                <Text style={styles.modeButtonSubtext}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Login or Register form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>🏆 TopRate</Text>
          {renderHelp()}
          <Text style={styles.subtitle}>
            {mode === 'register' ? 'Create Account' : 'Log In'}
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              maxLength={8}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading
                  ? 'Loading...'
                  : mode === 'register'
                  ? 'Create Account'
                  : 'Log In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setMode('select');
                setUsername('');
                setPassword('');
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 8,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignItems: 'stretch',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF9500',
    marginTop: 8,
    marginBottom: 6,
  },
  helpContainer: {
    width: 540,
    maxWidth: '100%',
    alignSelf: 'center',
    marginTop: -8,
    height: 660,
    maxHeight: 720,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 0,
    paddingBottom: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 6,
  },
  modeSelectionContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    alignItems: 'center',
    alignSelf: 'center',
  },
  modeButton: {
    backgroundColor: '#FF9500',
    width: 300,
    maxWidth: '100%',
    paddingVertical: 4,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  modeButtonSubtext: {
    color: '#FFFFFF',
    fontSize: 11,
    opacity: 0.72,
  },
  form: {
    width: '100%',
    maxWidth: 300,
    marginTop: 6,
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
  },
  helpSectionWrapper: {
    gap: 6,
  },
  helpSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  helpBullet: {
    fontSize: 14,
    color: '#FF9500',
    lineHeight: 19,
  },
  helpText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    textAlign: 'justify',
  },
  helpScroll: {
    width: '100%',
    height: '100%',
  },
  helpScrollContent: {
    paddingRight: 4,
    paddingVertical: 8,
  },
});

export default LoginScreen;
