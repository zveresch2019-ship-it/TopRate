import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
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
  const { t, language, setLanguage } = useLanguage();

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ru' : 'en');
  }, [language, setLanguage]);

  const isAuthMode = mode === 'login' || mode === 'register';

  const helpSlides = useMemo(() => (
    [
      t('help.purpose'),
      t('help.add_players'),
      t('help.initial_rating'),
      t('help.rating_changes'),
      t('help.change_factors'),
    ]
      .filter(Boolean)
      .map(text => text.replace(/^•\s*/, '').trim())
  ), [t]);

  const extendedSlides = useMemo(() => (
    helpSlides.length > 0 ? [...helpSlides, helpSlides[0]] : []
  ), [helpSlides]);

  const [helpWidth, setHelpWidth] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const helpScrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleHelpLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    if (width !== helpWidth) {
      setHelpWidth(width);
      setActiveSlide(0);
      requestAnimationFrame(() => {
        helpScrollRef.current?.scrollTo({ x: 0, animated: false });
      });
    }
  }, [helpWidth]);

  const handleHelpMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!helpWidth || helpSlides.length === 0) {
      return;
    }
    const offsetX = event.nativeEvent.contentOffset.x;
    let index = Math.round(offsetX / helpWidth);
    if (index >= helpSlides.length) {
      helpScrollRef.current?.scrollTo({ x: 0, animated: false });
      index = 0;
    }
    setActiveSlide(index);
  }, [helpWidth, helpSlides.length]);

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
    return lines.join('\n\n');
  }, [t]);

  const renderHelp = () => (
    <View style={styles.helpContainer}>
      <View style={styles.helpScrollWrapper} onLayout={handleHelpLayout}>
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          ref={helpScrollRef}
          style={styles.helpScroll}
          contentContainerStyle={styles.helpScrollContent}
          onMomentumScrollEnd={handleHelpMomentumEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          snapToInterval={helpWidth || undefined}
          decelerationRate="fast"
          bounces={false}
        >
          {extendedSlides.map((slide, index) => {
            const inputRange = [
              (index - 1) * helpWidth,
              index * helpWidth,
              (index + 1) * helpWidth,
            ];
            const scale = helpWidth
              ? scrollX.interpolate({
                  inputRange,
                  outputRange: [0.85, 1, 0.85],
                  extrapolate: 'clamp',
                })
              : 1;
            const opacity = helpWidth
              ? scrollX.interpolate({
                  inputRange,
                  outputRange: [0.35, 1, 0.35],
                  extrapolate: 'clamp',
                })
              : 1;
            const rotateY = helpWidth
              ? scrollX.interpolate({
                  inputRange,
                  outputRange: ['24deg', '0deg', '-24deg'],
                  extrapolate: 'clamp',
                })
              : '0deg';
            const translateX = helpWidth
              ? scrollX.interpolate({
                  inputRange,
                  outputRange: [-40, 0, 40],
                  extrapolate: 'clamp',
                })
              : 0;
            const shadowOpacity = helpWidth
              ? scrollX.interpolate({
                  inputRange,
                  outputRange: [0.05, 0.2, 0.05],
                  extrapolate: 'clamp',
                })
              : 0.2;
            return (
              <Animated.View
                key={`help-${index}`}
                style={[
                  styles.helpSlide,
                  helpWidth ? { width: helpWidth } : null,
                  {
                    transform: [
                      { perspective: 800 },
                      { translateX },
                      { rotateY },
                      { scale },
                    ],
                    opacity,
                    shadowOpacity,
                  },
                ]}
              >
                <Text style={styles.helpText}>{slide}</Text>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      </View>
      {helpSlides.length > 1 && (
        <View style={styles.helpDotsContainer}>
          {helpSlides.map((_, index) => {
            const forIndex = index === helpSlides.length ? 0 : index;
            const dotOpacity = scrollX.interpolate({
              inputRange: helpSlides.map((_, i) => i * helpWidth),
              outputRange: helpSlides.map((_, i) => (i === forIndex ? 1 : 0.3)),
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={`dot-${index}`}
                style={[styles.helpDot, { opacity: dotOpacity }]}
              />
            );
          })}
        </View>
      )}
      {helpSlides.length > 0 && (
        <Text style={styles.helpIndicator}>
          {language === 'en' ? 'Slide' : 'Слайд'} {activeSlide + 1}/{helpSlides.length}
        </Text>
      )}
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
            <View style={styles.headerRow}>
              <Text style={styles.title}>🏆 TopRate</Text>
              <TouchableOpacity style={styles.langButton} onPress={toggleLanguage}>
                <Text style={styles.langButtonText}>{language === 'en' ? 'EN' : 'RU'}</Text>
              </TouchableOpacity>
            </View>
            {renderHelp()}
            <View style={styles.modeSelectionContainer}>
              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => handleModeSelect('login')}
              >
                <Text style={styles.modeButtonText}>{language === 'en' ? 'Log In' : 'Войти'}</Text>
                <Text style={styles.modeButtonSubtext}>{language === 'en' ? 'For existing users' : 'Для уже зарегистрированных'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeButton, styles.modeButtonSecondary]}
                onPress={() => handleModeSelect('register')}
              >
                <Text style={styles.modeButtonText}>{language === 'en' ? 'New User' : 'Новый пользователь'}</Text>
                <Text style={styles.modeButtonSubtext}>{language === 'en' ? 'Create account' : 'Создать аккаунт'}</Text>
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
        <View style={[styles.content, isAuthMode && styles.authContent]}>
          <View style={[styles.headerRow, isAuthMode && styles.headerRowAuth]}>
            <Text style={[styles.title, isAuthMode && styles.titleAuth]}>🏆 TopRate</Text>
            <TouchableOpacity
              style={[styles.langButton, isAuthMode && styles.langButtonAuth]}
              onPress={toggleLanguage}
            >
              <Text style={styles.langButtonText}>{language === 'en' ? 'EN' : 'RU'}</Text>
            </TouchableOpacity>
          </View>
          {renderHelp()}
          <Text style={[styles.subtitle, isAuthMode && styles.subtitleAuth]}>
            {mode === 'register'
              ? language === 'en' ? 'Create Account' : 'Создать аккаунт'
              : language === 'en' ? 'Log In' : 'Вход'}
          </Text>

          <View style={[styles.form, isAuthMode && styles.formAuth]}>
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
                  ? language === 'en' ? 'Loading...' : 'Загрузка...'
                  : mode === 'register'
                  ? language === 'en' ? 'Create Account' : 'Создать аккаунт'
                  : language === 'en' ? 'Log In' : 'Войти'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backButton, isAuthMode && styles.backButtonAuth]}
              onPress={() => {
                setMode('select');
                setUsername('');
                setPassword('');
              }}
            >
              <Text style={styles.backButtonText}>
                {language === 'en' ? '← Back' : '← Назад'}
              </Text>
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
    maxWidth: 580,
    alignItems: 'stretch',
    gap: 8,
  },
  authContent: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF9500',
    marginTop: 8,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  titleAuth: {
    marginTop: 2,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRowAuth: {
    width: '100%',
    position: 'relative',
    justifyContent: 'space-between',
  },
  langButton: {
    minWidth: 62,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1B2940',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  langButtonAuth: {
    position: 'relative',
  },
  helpContainer: {
    width: 560,
    maxWidth: '100%',
    alignSelf: 'center',
    marginTop: -6,
    height: 480,
    maxHeight: 480,
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
  subtitleAuth: {
    marginTop: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  modeSelectionContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    alignItems: 'stretch',
    alignSelf: 'center',
    marginTop: 24,
  },
  modeButton: {
    backgroundColor: '#FF9500',
    width: 320,
    maxWidth: '100%',
    paddingVertical: 12,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#C05A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#D26E00',
    borderTopWidth: 1,
    borderTopColor: '#FFA94D',
  },
  modeButtonSecondary: {
    marginTop: 12,
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  modeButtonSubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 300,
    marginTop: 6,
    gap: 12,
  },
  formAuth: {
    marginTop: 0,
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 6,
  },
  submitButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#C05A00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#D26E00',
    borderTopWidth: 1,
    borderTopColor: '#FFA94D',
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
    marginTop: 16,
    alignItems: 'center',
  },
  backButtonAuth: {
    marginTop: 4,
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
    fontSize: 16,
    color: '#2F2F2F',
    lineHeight: 20,
    textAlign: 'center',
  },
  helpScrollWrapper: {
    flexGrow: 1,
    height: '85%',
    overflow: 'hidden',
    justifyContent: 'center',
    paddingTop: 20,
  },
  helpScroll: {
    width: '100%',
    height: '100%',
  },
  helpScrollContent: {
    alignItems: 'stretch',
  },
  helpSlide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#F3F6FF',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    paddingVertical: 12,
  },
  helpIndicator: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#1B2940',
    textAlign: 'center',
  },
  helpDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  helpDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1B2940',
  },
});

export default LoginScreen;
