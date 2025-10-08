import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_STORAGE_KEY = 'rideshare_auth';
const USERS_REGISTRY_KEY = 'app_users_registry';

interface UsersRegistry {
  [username: string]: AuthUser;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (user: AuthUser) => {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Ошибка сохранения пользователя:', error);
    }
  };

  const loadRegistry = async (): Promise<UsersRegistry> => {
    try {
      const data = await AsyncStorage.getItem(USERS_REGISTRY_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  };

  const saveRegistry = async (registry: UsersRegistry) => {
    try {
      await AsyncStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.error('Ошибка сохранения реестра пользователей:', e);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      if (username && password) {
        const registry = await loadRegistry();
        let user = registry[username];
        if (!user) {
          user = {
            id: `auth_${username}`,
            username,
            email: `${username}@example.com`,
            createdAt: new Date().toISOString(),
          };
          registry[username] = user;
          await saveRegistry(registry);
        }
        setCurrentUser(user);
        await saveUser(user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ошибка входа:', error);
      return false;
    }
  };

  const register = async (username: string, password: string, email: string): Promise<boolean> => {
    try {
      if (username && password && email) {
        const registry = await loadRegistry();
        let user = registry[username];
        if (!user) {
          user = {
            id: `auth_${username}`,
            username,
            email,
            createdAt: new Date().toISOString(),
          };
          registry[username] = user;
          await saveRegistry(registry);
        }
        setCurrentUser(user);
        await saveUser(user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setCurrentUser(null);
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const switchUser = async (username: string): Promise<boolean> => {
    try {
      const registry = await loadRegistry();
      let user = registry[username];
      if (!user) {
        user = {
          id: `auth_${username}`,
          username,
          email: `${username}@example.com`,
          createdAt: new Date().toISOString(),
        };
        registry[username] = user;
        await saveRegistry(registry);
      }
      setCurrentUser(user);
      await saveUser(user);
      return true;
    } catch (error) {
      console.error('Ошибка переключения пользователя:', error);
      return false;
    }
  };

  const getAvailableUsers = async (): Promise<string[]> => {
    try {
      // Для демо возвращаем список пользователей
      return ['user1', 'user2', 'user3'];
    } catch (error) {
      console.error('Ошибка получения пользователей:', error);
      return [];
    }
  };

  const value: AuthContextType = {
    currentUser,
    isLoading,
    login,
    register,
    logout,
    switchUser,
    getAvailableUsers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};