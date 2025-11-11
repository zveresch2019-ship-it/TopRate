import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthContextType } from '../types';
import { authAPI, getAuthToken, removeAuthToken } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_STORAGE_KEY = 'rideshare_auth';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      console.log('🔄 Loading user...');
      setIsLoading(true);
      const token = await getAuthToken();
      console.log('🔄 Token found:', token ? 'yes' : 'no');
      console.log('🔄 Token value:', token ? token.substring(0, 20) + '...' : 'null');
      
      if (token) {
        // Проверяем токен через API
        try {
          const data = await authAPI.getCurrentUser();
          console.log('✅ User loaded from API:', data);
          console.log('✅ User role from API:', data.user?.role);
          console.log('✅ User groupId from API:', data.user?.groupId);
          console.log('✅ Data type:', typeof data);
          console.log('✅ Data keys:', Object.keys(data || {}));
          
          const user: AuthUser = {
            id: data.user.id?.toString() || data.user._id?.toString() || '',
            username: data.user.username,
            role: data.user.role || 'user',
            createdAt: data.user.createdAt,
            groupId: data.user.groupId?.toString(),
            groupName: data.user.groupName,
          };
          
          console.log('✅ Setting currentUser:', user);
          console.log('✅ User role before setting:', user.role);
          console.log('✅ User groupId before setting:', user.groupId);
          setCurrentUser(user);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
          console.log('✅ User saved to storage');
          console.log('✅ loadUser completed, currentUser should be updated');
        } catch (error) {
          console.error('❌ Error loading user from API:', error);
          console.error('❌ Error details:', JSON.stringify(error, null, 2));
          console.error('❌ Token invalid, clearing...');
          await removeAuthToken();
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } else {
        // Нет токена, проверяем локальное хранилище (для совместимости)
      const userData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (userData) {
          console.log('⚠️ Found local user data (legacy), clearing...');
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('❌ Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('🔄 Logging in:', username);
      
      if (!username || !password) {
        console.log('⚠️ Empty credentials');
        return false;
      }

      let data;
      try {
        data = await authAPI.login(username, password);
        console.log('✅ Login response:', JSON.stringify(data, null, 2));
      } catch (error: any) {
        const normalizedMessage = (error?.message || '').toLowerCase();
        if (normalizedMessage.includes('invalid username or password') || normalizedMessage.includes('invalid credentials')) {
          return false;
        }

        const token = await getAuthToken();
        if (token) {
          console.log('✅ Token saved despite login error, treating as success');
          try {
            const userData = await authAPI.getCurrentUser();
            if (userData && userData.user) {
              const user: AuthUser = {
                id: userData.user.id?.toString() || userData.user._id?.toString() || '',
                username: userData.user.username,
                role: userData.user.role || 'user',
                createdAt: userData.user.createdAt,
                groupId: userData.user.groupId?.toString(),
                groupName: userData.user.groupName,
              };
              console.log('✅ Setting currentUser after login (from token):', JSON.stringify(user, null, 2));
              setCurrentUser(user);
              await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
              return true;
            }
          } catch (loadError) {
            console.warn('Login: Unable to load user after token save:', loadError);
          }
        }

        throw error;
      }
      
      // Проверяем, что ответ содержит пользователя
      if (!data) {
        console.error('❌ Login response is null or undefined');
        return false;
      }
      
      if (!data.user) {
        console.error('❌ Login response missing user data. Response:', JSON.stringify(data, null, 2));
        // Если токен есть, но нет пользователя - пытаемся загрузить пользователя
        if (data.token) {
          console.log('⚠️ Login response has token but no user, loading user...');
          try {
            const userData = await authAPI.getCurrentUser();
            if (userData && userData.user) {
              data.user = userData.user;
            }
          } catch (loadError) {
            console.error('❌ Error loading user after login:', loadError);
            return false;
          }
        } else {
      return false;
        }
      }
      
      console.log('✅ User data found in response:', {
        id: data.user.id || data.user._id,
        username: data.user.username,
        role: data.user.role,
        groupId: data.user.groupId
      });
      
      const user: AuthUser = {
        id: data.user.id?.toString() || data.user._id?.toString() || '',
        username: data.user.username,
        role: data.user.role || 'user',
        createdAt: data.user.createdAt,
        groupId: data.user.groupId?.toString(),
        groupName: data.user.groupName,
      };
      
      console.log('✅ Setting currentUser after login:', JSON.stringify(user, null, 2));
      setCurrentUser(user);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      console.log('✅ User saved to AsyncStorage');
      
      return true;
    } catch (error: any) {
      const normalizedMessage = (error?.message || '').toLowerCase();
      if (!normalizedMessage.includes('invalid username or password') && !normalizedMessage.includes('invalid credentials')) {
        console.warn('Login: Unexpected error', error);
      }
      return false;
    }
  };

  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('🔄 Registering:', username);
      
      if (!username || !password) {
        console.log('⚠️ Empty credentials');
        return false;
      }

      let data;
      try {
        data = await authAPI.register(username, password);
        console.log('✅ Register response:', JSON.stringify(data, null, 2));
        
        // Проверяем, если в ответе есть error (но нет токена) - это "username already taken"
        if (data.error && !data.token) {
          const isUsernameTaken = (data.error || '').toLowerCase().includes('username already taken') ||
                                 (data.error || '').toLowerCase().includes('already taken') ||
                                 (data.error || '').toLowerCase().includes('пользователь уже существует');
          
          if (isUsernameTaken) {
            // Это "username already taken" - НЕ пробрасываем ошибку, возвращаем false
            console.log('ℹ️ Register: Username already taken (from response), returning false');
            return false;
          }
        }
      } catch (error: any) {
        // Если произошла ошибка, проверяем, был ли сохранен токен
        const token = await getAuthToken();
        if (token) {
          // Токен сохранен - значит регистрация прошла успешно, несмотря на ошибку
          console.log('✅ Token saved despite error, registration successful');
          // Пытаемся загрузить пользователя по токену
          try {
            const userData = await authAPI.getCurrentUser();
            if (userData && userData.user) {
        const user: AuthUser = {
                id: userData.user.id?.toString() || userData.user._id?.toString() || '',
                username: userData.user.username,
                role: userData.user.role || 'user',
                createdAt: userData.user.createdAt,
                groupId: userData.user.groupId?.toString(),
                groupName: userData.user.groupName,
              };
              console.log('✅ Setting currentUser after registration (from token):', JSON.stringify(user, null, 2));
              setCurrentUser(user);
              await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
              return true;
            }
          } catch (loadError) {
            console.error('❌ Error loading user after registration:', loadError);
          }
        }
        
        const errorMsg = error?.message || '';
        
        // Проверяем, это "username already taken"?
        const isUsernameTaken = errorMsg.toLowerCase().includes('username already taken') ||
                               errorMsg.toLowerCase().includes('already taken') ||
                               errorMsg.toLowerCase().includes('пользователь уже существует');
        
        // Проверяем, это ошибка валидации?
        const isValidationError = errorMsg.toLowerCase().includes('должно быть от 3 до 8') ||
                                 errorMsg.toLowerCase().includes('must be 3-8 characters') ||
                                 errorMsg.toLowerCase().includes('должен быть минимум 6') ||
                                 errorMsg.toLowerCase().includes('must be at least 6') ||
                                 errorMsg.toLowerCase().includes('validation error') ||
                                 errorMsg.toLowerCase().includes('обязательно') ||
                                 errorMsg.toLowerCase().includes('required');
        
        // Проверяем, валидны ли текущие значения
        const isCurrentUsernameValid = username.trim().length >= 3 && username.trim().length <= 8;
        const isCurrentPasswordValid = password.trim().length >= 6;
        
        if (isUsernameTaken) {
          // Для "username already taken" НЕ пробрасываем ошибку - возвращаем false
          console.log('ℹ️ Register: Username already taken (from exception), returning false');
          return false;
        } else if (isValidationError && isCurrentUsernameValid && isCurrentPasswordValid) {
          // Ошибка валидации, но данные уже валидны - не пробрасываем ошибку
          console.log('ℹ️ Register: Validation error but data is now valid, returning false (no error)');
          return false;
        }
        
        // Для ошибок валидации с невалидными данными или других ошибок - пробрасываем ошибку дальше
        if (isValidationError) {
          // Ошибка валидации - логируем как информационное сообщение, не как ошибку
          console.log('ℹ️ Register: Validation error (data not valid), throwing error');
        } else {
          // Другие ошибки (не валидация) - логируем как ошибку
          // Проверяем, не является ли это ошибкой валидации перед логированием
          const errorMsgBeforeCheck = (error?.message || '').toLowerCase();
          const isValidationErrorBeforeCheck = errorMsgBeforeCheck.includes('должно быть от 3 до 8') ||
                                             errorMsgBeforeCheck.includes('must be 3-8 characters') ||
                                             errorMsgBeforeCheck.includes('должен быть минимум 6') ||
                                             errorMsgBeforeCheck.includes('must be at least 6') ||
                                             errorMsgBeforeCheck.includes('validation error');
          
          if (isValidationErrorBeforeCheck) {
            // Ошибки валидации логируем как INFO
            console.log('ℹ️ Register: Validation error (no token):', error?.message || error);
          } else {
            // Другие ошибки логируем как ERROR
            console.error('❌ Register error and no token:', error);
          }
        }
        throw error;
      }
      
      // Проверяем, что ответ содержит пользователя и токен
      if (!data) {
        console.error('❌ Register response is null or undefined');
        return false;
      }
      
      // Если есть токен - регистрация успешна, игнорируем любые ошибки в ответе
      // (возможно, они остались от предыдущего запроса или добавлены сервером по ошибке)
      if (data.token) {
        // Есть токен - регистрация успешна, игнорируем ошибки валидации в ответе
        if (data.error || data.errors) {
          console.log('⚠️ Register: Response contains token but also has errors - ignoring errors, registration successful');
        }
        // Продолжаем обработку успешной регистрации
      } else if (data.error) {
        // Нет токена, но есть ошибка - проверяем тип ошибки
        const isUsernameTaken = (data.error || '').toLowerCase().includes('username already taken') ||
                               (data.error || '').toLowerCase().includes('already taken') ||
                               (data.error || '').toLowerCase().includes('пользователь уже существует');
        
        // Проверяем, это ошибка валидации?
        const isValidationError = (data.error || '').toLowerCase().includes('должно быть от 3 до 8') ||
                                 (data.error || '').toLowerCase().includes('must be 3-8 characters') ||
                                 (data.error || '').toLowerCase().includes('должен быть минимум 6') ||
                                 (data.error || '').toLowerCase().includes('must be at least 6') ||
                                 (data.error || '').toLowerCase().includes('validation error') ||
                                 (data.error || '').toLowerCase().includes('обязательно') ||
                                 (data.error || '').toLowerCase().includes('required');
        
        // Проверяем, валидны ли текущие значения ДО проверки ошибки
        const isCurrentUsernameValid = username.trim().length >= 3 && username.trim().length <= 8;
        const isCurrentPasswordValid = password.trim().length >= 6;
        
        if (isUsernameTaken) {
          // Это "username already taken" - НЕ пробрасываем ошибку, возвращаем false
          console.log('ℹ️ Register: Username already taken (from error in response), returning false');
          return false;
        } else if (isValidationError) {
          // Проверяем, исправлена ли проблема
          const usernameError = (data.error || '').toLowerCase().includes('имя') || 
                               (data.error || '').toLowerCase().includes('username') ||
                               (data.error || '').toLowerCase().includes('3-8') ||
                               (data.error || '').toLowerCase().includes('от 3 до 8');
          const passwordError = (data.error || '').toLowerCase().includes('пароль') || 
                               (data.error || '').toLowerCase().includes('password') ||
                               (data.error || '').toLowerCase().includes('at least 6') ||
                               (data.error || '').toLowerCase().includes('минимум 6');
          
          // Если имя и пароль валидны, игнорируем ошибку валидации (она могла остаться от предыдущего запроса)
          if (isCurrentUsernameValid && isCurrentPasswordValid) {
            console.log('ℹ️ Register: Validation error but username and password are valid, ignoring error');
            // Не пробрасываем ошибку, но регистрация все равно не прошла (нет токена)
            // Возвращаем false, чтобы LoginScreen мог попробовать еще раз
            return false;
          }
          
          // Если проблема не исправлена - пробрасываем ошибку валидации для показа Alert
          console.log('ℹ️ Register: Validation error (problem not fixed), throwing error');
          throw new Error(data.error);
        } else {
          // Другие ошибки - проверяем, не является ли это ошибкой валидации
          const isValidationErrorInResponse = (data.error || '').toLowerCase().includes('должно быть от 3 до 8') ||
                                              (data.error || '').toLowerCase().includes('must be 3-8 characters') ||
                                              (data.error || '').toLowerCase().includes('должен быть минимум 6') ||
                                              (data.error || '').toLowerCase().includes('must be at least 6') ||
                                              (data.error || '').toLowerCase().includes('validation error');
          
          if (isValidationErrorInResponse) {
            // Ошибки валидации логируем как INFO
            console.log('ℹ️ Register: Validation error in response:', data.error);
          } else {
            // Другие ошибки логируем как ERROR
            console.error('❌ Register response contains error:', data.error);
          }
          throw new Error(data.error);
        }
      }
      
      // Если токен есть, но нет пользователя - пытаемся загрузить пользователя
      if (data.token && !data.user) {
        console.log('⚠️ Register response has token but no user, loading user...');
        try {
          const userData = await authAPI.getCurrentUser();
          if (userData && userData.user) {
            data.user = userData.user;
          }
        } catch (loadError) {
          // Ошибка загрузки пользователя - это не ошибка валидации, логируем как ERROR
          console.error('❌ Error loading user after registration:', loadError);
        }
      }
      
      if (!data.user || !data.token) {
        // Отсутствие пользователя или токена - это не ошибка валидации, логируем как ERROR
        console.error('❌ Register response missing user or token data:', data);
        return false;
      }
      
      const user: AuthUser = {
        id: data.user.id?.toString() || data.user._id?.toString() || '',
        username: data.user.username,
        role: data.user.role || 'user',
        createdAt: data.user.createdAt,
        groupId: data.user.groupId?.toString(),
        groupName: data.user.groupName,
      };
      
      console.log('✅ Setting currentUser after registration:', JSON.stringify(user, null, 2));
        setCurrentUser(user);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      console.log('✅ User saved to AsyncStorage');
      
        return true;
    } catch (error: any) {
      // Не логируем как ошибку, если это "username already taken" или ошибка валидации - это нормальная ситуация
      const errorMsg = error?.message || '';
      const isUsernameTaken = errorMsg.toLowerCase().includes('username already taken') ||
                              errorMsg.toLowerCase().includes('already taken') ||
                              errorMsg.toLowerCase().includes('пользователь уже существует');
      
      // Проверяем, это ошибка валидации?
      const isValidationError = errorMsg.toLowerCase().includes('должно быть от 3 до 8') ||
                               errorMsg.toLowerCase().includes('must be 3-8 characters') ||
                               errorMsg.toLowerCase().includes('должен быть минимум 6') ||
                               errorMsg.toLowerCase().includes('must be at least 6') ||
                               errorMsg.toLowerCase().includes('validation error') ||
                               errorMsg.toLowerCase().includes('обязательно') ||
                               errorMsg.toLowerCase().includes('required');
      
      if (!isUsernameTaken && !isValidationError) {
        // Реальные ошибки (не валидация и не "username already taken") - логируем как ошибку
        console.error('❌ Register error:', error);
        console.error('❌ Register error message:', errorMsg);
        // Пробрасываем только реальные ошибки
        throw error;
      } else if (isValidationError) {
        // Ошибка валидации - логируем как информационное сообщение (Alert уже показан в LoginScreen)
        console.log('ℹ️ Register: Validation error (Alert shown in LoginScreen):', errorMsg);
        // Пробрасываем ошибку, чтобы LoginScreen мог показать Alert
        throw error;
      } else {
        // Для "username already taken" НЕ пробрасываем ошибку - это нормальная ситуация
        // Возвращаем false, чтобы LoginScreen мог обработать это и попробовать автоматический логин
        console.log('ℹ️ Register: Username already taken (informational), returning false');
        return false;
      }
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('🔄 Logging out...');
      console.log('AuthContext: currentUser before logout:', currentUser);
      
      // Очищаем токен и локальные данные
      await removeAuthToken();
      console.log('✅ Token removed');
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      console.log('✅ Storage cleared');
      setCurrentUser(null);
      console.log('✅ currentUser set to null');
      
      console.log('AuthContext: currentUser after logout:', null);
      console.log('✅ Logged out');
      
      // Принудительно обновляем состояние
      setTimeout(() => {
        console.log('AuthContext: Force refresh after logout');
        setCurrentUser(null);
      }, 100);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const deleteAccount = async (): Promise<boolean> => {
    try {
      console.log('🔄 Deleting account...');
      
      await authAPI.deleteAccount();
      
      // Очищаем локальные данные
      await removeAuthToken();
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setCurrentUser(null);
      
      console.log('✅ Account deleted');
      return true;
    } catch (error) {
      console.error('❌ Delete account error:', error);
      return false;
    }
  };

  const switchUser = async (username: string): Promise<boolean> => {
    // В API версии переключение пользователя = выход
    await logout();
    return true;
  };

  const updateUser = (updates: Partial<AuthUser>): void => {
    console.log('AuthContext: updateUser called with updates:', updates);
    console.log('AuthContext: currentUser before update:', currentUser);
    
    if (currentUser) {
      // Обновляем существующего пользователя
      const updatedUser = { ...currentUser, ...updates };
      console.log('AuthContext: updatedUser after merge:', updatedUser);
      setCurrentUser(updatedUser);
      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      console.log('AuthContext: User updated and saved to storage');
    } else {
      // Создаем нового пользователя (для регистрации)
      console.log('AuthContext: Creating new user from updates');
      setCurrentUser(updates as AuthUser);
      AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updates));
      console.log('AuthContext: New user created and saved to storage');
    }
  };

  const getAvailableUsers = async (): Promise<string[]> => {
    // В API версии нет списка пользователей на клиенте
      return [];
  };

  return (
    <AuthContext.Provider
      value={{
    currentUser,
    isLoading,
    login,
    register,
    logout,
    switchUser,
        deleteAccount,
    getAvailableUsers,
        updateUser,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
