import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// @ts-ignore - expo-constants is available in Expo runtime
import Constants from 'expo-constants';

// API Configuration: автоопределение IP хоста для iOS/Android (Expo) + ENV override
function getEnvApiUrl(): string | undefined {
  try {
    const fromProcess = (process as any)?.env?.EXPO_PUBLIC_API_URL as string | undefined;
    const fromConstants = (Constants as any)?.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string | undefined;
    return fromProcess || fromConstants;
  } catch {
    return undefined;
  }
}

function resolveDevApiUrl(): string {
  const envUrl = getEnvApiUrl();
  if (envUrl) return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api';
  }
  try {
    const hostUri: string | undefined = (Constants as any)?.expoConfig?.hostUri
      || (Constants as any)?.manifest?.hostUri
      || (Constants as any)?.manifest?.debuggerHost;
    if (hostUri && typeof hostUri === 'string') {
      const host = hostUri.split(':')[0];
      // если tunnel (exp.direct/exp.dev), этот хост не даст доступ к 3000 → просим ENV/LAN
      if (/exp\.(direct|dev)$/i.test(host)) {
        return 'http://localhost:3000/api';
      }
      if (host) return `http://${host}:3000/api`;
    }
  } catch {}
  // fallback: попросит эмулятор/устройство ходить на локальный комп вручную, если не удалось получить host
  return 'http://localhost:3000/api';
}

// Production API URL - замените на ваш URL после деплоя сервера
// Например: 'https://your-app.herokuapp.com/api'
// Или используйте переменную окружения EXPO_PUBLIC_API_URL
const API_URL = __DEV__
  ? resolveDevApiUrl()
  : getEnvApiUrl() || 'https://your-production-api.com/api'; // ← Замените на реальный URL при деплое

// Token management
const TOKEN_KEY = '@auth_token';

export const setAuthToken = async (token: string) => {
  console.log('🔐 Saving token to AsyncStorage:', token ? 'yes' : 'no');
  await AsyncStorage.setItem(TOKEN_KEY, token);
  console.log('✅ Token saved successfully');
};

export const getAuthToken = async (): Promise<string | null> => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  console.log('🔍 Getting token from AsyncStorage:', token ? 'found' : 'not found');
  return token;
};

export const removeAuthToken = async () => {
  console.log('🔑 Removing auth token...');
  await AsyncStorage.removeItem(TOKEN_KEY);
  console.log('✅ Auth token removed');
};

// Generic API request function
const apiRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
) => {
  try {
    const token = await getAuthToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    console.log(`📡 API Request: ${method} ${API_URL}${endpoint}`);
    console.log(`📡 Request headers:`, {
      'Content-Type': headers['Content-Type'],
      'Authorization': token ? `Bearer ${token.substring(0, 20)}...` : 'none',
      'ngrok-skip-browser-warning': 'true'
    });
    if (body) {
      console.log(`📡 Request body:`, JSON.stringify(body, null, 2));
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
           const response = await fetch(`${API_URL}${endpoint}`, {
             ...config,
             signal: controller.signal,
             headers: {
               ...config.headers,
               'ngrok-skip-browser-warning': 'true', // Skip ngrok browser warning
             },
           });
      clearTimeout(timeoutId);
      
      console.log(`✅ API Response: ${response.status} ${response.statusText}`);
    
    // Parse response безопасно
    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        // Не удалось распарсить JSON - возможно, это HTML ошибка от ngrok
        const text = await response.text();
        data = { raw: text, error: 'Server connection error' };
      }
    } else {
      const text = await response.text();
      // Спец-обработка 404 /groups → возвращаем пустой список
      if (response.status === 404 && endpoint.startsWith('/groups')) {
        return { groups: [] };
      }
      // Если это HTML (от ngrok или другого прокси) - это ошибка подключения
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        // Это HTML ошибка - обычно от ngrok
        throw new Error('Server connection error: Unable to connect to the server. Please make sure the server is running on port 3000.');
      }
      // Для health/пустых ответов
      if (!text) {
        data = {};
      } else {
        // Сохраним как raw-текст для диагностики
        data = { raw: text };
      }
    }

    if (!response.ok) {
      // Улучшенная обработка ошибок с понятными сообщениями
      let errorMessage = data.error || data.message || `Server error (${response.status})`;
      
        // Обработка ошибок валидации (400)
        if (response.status === 400) {
          if (data.errors && Array.isArray(data.errors)) {
            // Ошибки валидации от express-validator
            const validationErrors = data.errors.map((err: any) => {
              // Преобразуем сообщения валидации в более понятные
              if (err.msg) {
                if (err.msg.includes('Username must be 3-8 characters') || 
                    err.msg.includes('должно быть от 3 до 8')) {
                  return 'Имя пользователя должно быть от 3 до 8 символов';
                }
                if (err.msg.includes('Password must be at least 6 characters') ||
                    err.msg.includes('должен быть минимум 6 символов') ||
                    err.msg.toLowerCase().includes('password') && err.msg.toLowerCase().includes('short')) {
                  return 'Пароль должен быть минимум 6 символов';
                }
                if (err.msg.toLowerCase().includes('username') && err.msg.toLowerCase().includes('required')) {
                  return 'Имя пользователя обязательно';
                }
                if (err.msg.toLowerCase().includes('password') && err.msg.toLowerCase().includes('required')) {
                  return 'Пароль обязателен';
                }
                return err.msg;
              }
              return err.message || 'Validation error';
            }).join('\n'); // Разделяем множественные ошибки новой строкой
            errorMessage = validationErrors || 'Validation error. Please check your input.';
          } else if (data.error) {
            // Обычная ошибка 400 - переводим сообщение от сервера на русский, если нужно
            if (data.error.toLowerCase().includes('username already taken') || 
                data.error.toLowerCase().includes('already taken')) {
              errorMessage = 'Пользователь уже существует';
            } else if (data.error.toLowerCase().includes('password') && data.error.toLowerCase().includes('short')) {
              errorMessage = 'Пароль должен быть минимум 6 символов';
            } else if (data.error.toLowerCase().includes('username') && data.error.toLowerCase().includes('3-8')) {
              errorMessage = 'Имя пользователя должно быть от 3 до 8 символов';
            } else {
              errorMessage = data.error;
            }
          }
        }
      
      // Специфичные сообщения для разных статусов
      if (response.status === 401) {
        // Для 401 используем сообщение от сервера, если оно есть
        // Проверяем конкретно "Invalid credentials", а не любую ошибку с "invalid"
        if (data.error && data.error.toLowerCase().includes('invalid credentials')) {
          errorMessage = 'Invalid credentials';
        } else {
          errorMessage = data.error || 'Authentication failed. Please login again.';
        }
        // Автоматически очищаем токен при ошибке 401
        console.log('🔑 401 Unauthorized - clearing auth token...');
        await removeAuthToken();
      } else if (response.status === 403) {
        errorMessage = 'Access denied.';
      } else if (response.status === 404) {
        // Специальная обработка для /groups и /seasons, если нет данных
        if (endpoint.endsWith('/groups')) {
          console.log('⚠️ GET /groups returned 404, treating as empty list.');
          return { groups: [] };
        }
        if (endpoint.includes('/seasons')) {
          console.log('⚠️ GET /seasons returned 404, treating as empty list.');
          return { seasons: [] };
        }
        errorMessage = 'Resource not found.';
      } else if (response.status === 500) {
        // Для ошибок сервера проверяем, не является ли это ошибкой валидации или дубликата
        const serverError = data?.error || data?.message || '';
        const isValidationOrDuplicate = serverError.toLowerCase().includes('validation') ||
                                        serverError.toLowerCase().includes('already exists') ||
                                        serverError.toLowerCase().includes('duplicate');
        
        // Проверяем, не связана ли ошибка с аутентификацией
        const isAuthError = serverError.toLowerCase().includes('token') ||
                           serverError.toLowerCase().includes('unauthorized') ||
                           serverError.toLowerCase().includes('authentication') ||
                           serverError.toLowerCase().includes('invalid');
        
        if (isAuthError) {
          // Если ошибка связана с аутентификацией, очищаем токен
          console.log('🔑 500 Server error with auth-related message - clearing auth token...');
          await removeAuthToken();
          errorMessage = 'Authentication failed. Please login again.';
        } else if (isValidationOrDuplicate) {
          errorMessage = serverError;
        } else {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      
      if (response.status === 401 && errorMessage.toLowerCase().includes('invalid credentials')) {
        throw new Error('Invalid username or password');
      }

      // Для ошибок "username already taken" не логируем как ошибку и не выбрасываем исключение
      const isUsernameTakenError = errorMessage.toLowerCase().includes('username already taken') || 
                                  errorMessage.toLowerCase().includes('already taken') ||
                                  errorMessage.toLowerCase().includes('пользователь уже существует');
      
      // Для ошибок валидации (длина имени и т.д.) тоже не выбрасываем исключение, но логируем как ошибку
      const isValidationError = errorMessage.toLowerCase().includes('должно быть от 3 до 8') ||
                               errorMessage.toLowerCase().includes('must be 3-8 characters') ||
                               errorMessage.toLowerCase().includes('должен быть минимум 6') ||
                               errorMessage.toLowerCase().includes('must be at least 6') ||
                               errorMessage.toLowerCase().includes('validation error') ||
                               errorMessage.toLowerCase().includes('обязательно') ||
                               errorMessage.toLowerCase().includes('required') ||
                               (data.errors && Array.isArray(data.errors));
      
      if (isUsernameTakenError) {
        // Информационное сообщение - логируем как info и возвращаем объект с ошибкой вместо выбрасывания
        console.log(`ℹ️ API Info [${method} ${endpoint}]: Username already taken`);
        // Возвращаем объект с ошибкой, чтобы вызывающий код мог обработать это без try-catch
        return { error: errorMessage, token: null, user: null };
      } else if (isValidationError && response.status === 400) {
        // Ошибки валидации - выбрасываем исключение, но логируем как информационное сообщение
        console.log(`ℹ️ API Validation Error [${method} ${endpoint}]:`, errorMessage);
        throw new Error(errorMessage);
      } else {
        // Проверяем, это ошибка "user already has a group"?
        const hasGroupError = errorMessage.toLowerCase().includes('user already has a group');
        
        if (hasGroupError) {
          // "User already has a group" - это информационное сообщение, не критическая ошибка
          console.log(`ℹ️ API Info [${method} ${endpoint}]: User already has a group`);
          throw new Error(errorMessage);
        } else {
          // Реальные ошибки логируем как ошибку и выбрасываем исключение
          // Проверяем, не является ли это ошибкой валидации
          const isValidationErrorInData = data?.error && (
            data.error.toLowerCase().includes('должно быть от 3 до 8') ||
            data.error.toLowerCase().includes('must be 3-8 characters') ||
            data.error.toLowerCase().includes('должен быть минимум 6') ||
            data.error.toLowerCase().includes('must be at least 6') ||
            data.error.toLowerCase().includes('validation error')
          );
          
          if (isValidationErrorInData) {
            // Ошибки валидации логируем как INFO, не ERROR
            console.log(`ℹ️ API Validation Error [${method} ${endpoint}]:`, data.error || data.message);
          } else {
            // Другие ошибки логируем как ERROR
            console.error(`❌ API Error [${method} ${endpoint}]:`, {
              status: response.status,
              statusText: response.statusText,
              data: data
            });
          }
          throw new Error(errorMessage);
        }
      }
    }

    // Успешный ответ (status 200-299) - проверяем, нет ли в ответе ошибок валидации
    // Если есть data.errors или data.error, но статус успешный - игнорируем их
    // так как сервер мог вернуть их по ошибке
    if (response.ok && data && (data.errors || data.error)) {
      // Успешный ответ, но есть ошибки в данных - это странно, но игнорируем ошибки
      // так как статус успешный и, вероятно, есть токен
      if (data.token) {
        console.log(`⚠️ API Warning [${method} ${endpoint}]: Successful response contains errors, but token present - ignoring errors`);
        // Очищаем ошибки из данных перед возвратом
        const { errors, error, ...cleanData } = data;
        return cleanData;
      }
    }

    return data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`⏱️ API Timeout [${method} ${endpoint}]: Request took longer than 30 seconds`);
        throw new Error('Request timeout - server not responding. Check your internet connection.');
      }
      
      // Обработка сетевых ошибок
      if (fetchError.message && fetchError.message.includes('Network request failed')) {
        throw new Error('Network error. Check your internet connection.');
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    // Проверяем, не является ли это ошибкой валидации
    const errorMsg = (error?.message || '').toLowerCase();
    const isValidationError = errorMsg.includes('должно быть от 3 до 8') ||
                             errorMsg.includes('must be 3-8 characters') ||
                             errorMsg.includes('должен быть минимум 6') ||
                             errorMsg.includes('must be at least 6') ||
                             errorMsg.includes('validation error');
    
    // Проверяем, не является ли это ошибкой "Token invalid"
    const isTokenInvalid = errorMsg.includes('token invalid') || 
                           errorMsg.includes('invalid token') ||
                           errorMsg.includes('token expired');
    
    if (isTokenInvalid) {
      // Автоматически очищаем токен при ошибке "Token invalid"
      console.log('🔑 Token invalid detected - clearing auth token...');
      await removeAuthToken();
      console.log(`ℹ️ API Info [${method} ${endpoint}]: Token cleared, please login again`);
    } else if (isValidationError) {
      // Ошибки валидации логируем как INFO, не ERROR
      console.log(`ℹ️ API Validation Error [${method} ${endpoint}]:`, error?.message || error);
    } else {
      // Другие ошибки логируем как ERROR (кроме ожидаемых Invalid credentials)
      const normalized = (error?.message || '').toLowerCase();
      if (!(normalized.includes('invalid username or password') || normalized.includes('invalid credentials'))) {
        console.error(`❌ API Error [${method} ${endpoint}]:`, error);
      }
    }
    
    // Если ошибка уже обработана (имеет понятное сообщение), просто пробрасываем
    if (error.message && !error.message.includes('Network') && !error.message.includes('timeout')) {
      throw error;
    }
    
    // Для необработанных ошибок добавляем понятное сообщение
    throw new Error(error.message || 'An unexpected error occurred. Please try again.');
  }
};

// Authentication API
export const authAPI = {
  register: async (username: string, password: string, groupName?: string, groupId?: string) => {
    try {
      const data = await apiRequest('/auth/register', 'POST', { username, password, groupName, groupId });
      console.log('📝 Register response:', data);
      
      // Проверяем, если apiRequest вернул объект с ошибкой (для "username already taken")
      if (data && data.error && !data.token) {
        // Это ошибка "username already taken" - возвращаем объект с ошибкой
        console.log('ℹ️ Register: Username already taken (from apiRequest)');
        return { error: data.error, token: null, user: null };
      }
      
      if (data.token) {
        console.log('🔐 Token found in response, saving...');
        await setAuthToken(data.token);
        console.log('✅ Token saved successfully');
      } else {
        console.log('❌ No token in response');
      }
      return data;
    } catch (error: any) {
      // Если произошла ошибка, проверяем, был ли сохранен токен перед этим
      const token = await getAuthToken();
      if (token) {
        // Токен сохранен - значит регистрация прошла успешно, несмотря на ошибку
        console.log('✅ Token exists despite error - registration successful');
        // Возвращаем данные с токеном, чтобы AuthContext мог обработать успешную регистрацию
        try {
          const userData = await authAPI.getCurrentUser();
          return {
            token,
            user: userData?.user || null,
            message: 'Registration successful'
          };
        } catch (loadError) {
          console.error('❌ Error loading user after registration:', loadError);
          // Возвращаем хотя бы токен
          return {
            token,
            user: null,
            message: 'Registration successful'
          };
        }
      }
      // Если токена нет - проверяем тип ошибки
      const isUsernameTaken = (error?.message || '').toLowerCase().includes('username already taken') ||
                              (error?.message || '').toLowerCase().includes('already taken') ||
                              (error?.message || '').toLowerCase().includes('пользователь уже существует');
      
      if (!isUsernameTaken) {
        // Проверяем, не является ли это ошибкой валидации
        const errorMsgForCheck = (error?.message || '').toLowerCase();
        const isValidationErrorForCheck = errorMsgForCheck.includes('должно быть от 3 до 8') ||
                                          errorMsgForCheck.includes('must be 3-8 characters') ||
                                          errorMsgForCheck.includes('должен быть минимум 6') ||
                                          errorMsgForCheck.includes('must be at least 6') ||
                                          errorMsgForCheck.includes('validation error');
        
        if (isValidationErrorForCheck) {
          // Ошибки валидации логируем как INFO
          console.log('ℹ️ Register: Validation error (no token):', error?.message || error);
        } else {
          // Реальные ошибки логируем как ERROR
          console.error('❌ Register error and no token:', error);
        }
        throw error;
      } else {
        // Для "username already taken" НЕ пробрасываем ошибку - возвращаем объект с ошибкой
        // чтобы AuthContext мог обработать это без выбрасывания исключения
        console.log('ℹ️ Register: Username already taken, returning error object instead of throwing');
        // Возвращаем объект ошибки, а не выбрасываем исключение
        return { error: 'Username already taken', token: null, user: null };
      }
    }
  },

  login: async (username: string, password: string) => {
    try {
      const data = await apiRequest('/auth/login', 'POST', { username, password });

      if (data.token) {
        await setAuthToken(data.token);
      }

      return data;
    } catch (error: any) {
      const message = (error?.message || '').toLowerCase();
      if (message.includes('invalid credentials')) {
        throw new Error('Invalid username or password');
      }
      throw error;
    }
  },

  logout: async () => {
    await removeAuthToken();
  },

  deleteAccount: async () => {
    const data = await apiRequest('/auth/account', 'DELETE');
    await removeAuthToken();
    return data;
  },

  getCurrentUser: async () => {
    return await apiRequest('/auth/me', 'GET');
  },

  createGroup: async (groupName: string) => {
    const data = await apiRequest('/auth/create-group', 'POST', { groupName });
    return data;
  },

  joinGroup: async (groupName: string) => {
    const data = await apiRequest('/auth/join-group', 'POST', { groupName });
    return data;
  }
};

// Players API
export const playersAPI = {
  getAll: async (season?: number, sportType?: string) => {
    const params = new URLSearchParams();
    if (season) params.append('season', season.toString());
    if (sportType) params.append('sportType', sportType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest(`/players${query}`, 'GET');
  },

  getById: async (id: string) => {
    return await apiRequest(`/players/${id}`, 'GET');
  },

  create: async (name: string, rating?: number, sportType?: string) => {
    const body = { name, rating, sportType };
    console.log('📤 playersAPI.create - Request body:', body);
    return await apiRequest('/players', 'POST', body);
  },

  update: async (id: string, data: { name?: string; rating?: number }) => {
    return await apiRequest(`/players/${id}`, 'PUT', data);
  },

  delete: async (id: string) => {
    return await apiRequest(`/players/${id}`, 'DELETE');
  },

  getStats: async (id: string) => {
    return await apiRequest(`/players/${id}/stats`, 'GET');
  }
};

// Matches API
export const matchesAPI = {
  getAll: async (season?: number, limit?: number, sportType?: string) => {
    const params = new URLSearchParams();
    if (season) params.append('season', season.toString());
    if (limit) params.append('limit', limit.toString());
    if (sportType) params.append('sportType', sportType);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiRequest(`/matches${query}`, 'GET');
  },

  getById: async (id: string) => {
    return await apiRequest(`/matches/${id}`, 'GET');
  },

  create: async (matchData: any) => {
    return await apiRequest('/matches', 'POST', matchData);
  },

  delete: async (id: string) => {
    return await apiRequest(`/matches/${id}`, 'DELETE');
  },

  getStats: async (season?: number) => {
    const query = season ? `?season=${season}` : '';
    return await apiRequest(`/matches/stats/summary${query}`, 'GET');
  }
};

// Seasons API
export const seasonsAPI = {
  getAll: async (sportType?: string) => {
    const query = sportType ? `?sportType=${sportType}` : '';
    return await apiRequest(`/seasons${query}`, 'GET');
  },

  getCurrent: async (sportType?: string) => {
    const query = sportType ? `?sportType=${sportType}` : '';
    return await apiRequest(`/seasons/current${query}`, 'GET');
  },

  getBySeason: async (seasonNumber: number) => {
    return await apiRequest(`/seasons/${seasonNumber}`, 'GET');
  },

  startNew: async (sportType?: string) => {
    return await apiRequest('/seasons/new', 'POST', { sportType });
  },

  getStats: async (seasonNumber: number) => {
    return await apiRequest(`/seasons/${seasonNumber}/stats`, 'GET');
  },

  delete: async (seasonNumber: number) => {
    return await apiRequest(`/seasons/${seasonNumber}`, 'DELETE');
  }
};

// Health check
export const healthCheck = async () => {
  try {
    console.log(`🏥 Checking server health at: ${API_URL.replace('/api', '')}/api/health`);
    const response = await fetch(`${API_URL.replace('/api', '')}/api/health`);
    console.log(`📊 Health check response status: ${response.status}`);
    const data = await response.json();
    console.log(`✅ Health check data:`, data);
    return data.status === 'ok';
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return false;
  }
};

// Groups API
export const groupsAPI = {
  getAll: async () => {
    return await apiRequest('/groups', 'GET');
  },

  join: async (groupId: string) => {
    return await apiRequest('/groups/join', 'POST', { groupId });
  }
};

export default {
  auth: authAPI,
  players: playersAPI,
  matches: matchesAPI,
  seasons: seasonsAPI,
  groups: groupsAPI,
  healthCheck
};

