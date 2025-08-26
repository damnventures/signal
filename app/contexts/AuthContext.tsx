'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  apiKey: string | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  setUserData: (user: User, accessToken: string, apiKey?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored authentication data on mount
  useEffect(() => {
    const loadAuthData = () => {
      try {
        const storedUser = localStorage.getItem('auth_user');
        const storedToken = localStorage.getItem('auth_access_token');
        const storedApiKey = localStorage.getItem('auth_api_key');

        if (storedUser && storedToken) {
          console.log('[AuthContext] Loading user from localStorage:', storedUser);
          setUser(JSON.parse(storedUser));
          setAccessToken(storedToken);
          if (storedApiKey) {
            console.log('[AuthContext] Loading apiKey from localStorage:', storedApiKey);
            setApiKey(storedApiKey);
          }
        } else if (storedToken) {
          // We have a token but no user - auth is in progress
          console.log('[AuthContext] Found access token, waiting for user data completion...');
          setAccessToken(storedToken);
          if (storedApiKey) {
            setApiKey(storedApiKey);
          }
        } else {
          console.log('[AuthContext] No auth data found in localStorage.');
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
        // Clear corrupted data
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_access_token');
        localStorage.removeItem('auth_api_key');
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthData();
  }, []);

  const login = () => {
    // Store origin in localStorage with a domain that works across shrinked.ai subdomains
    try {
      // Try to set a cookie that works across subdomains
      document.cookie = `auth_redirect_origin=${encodeURIComponent(window.location.origin)}; domain=.shrinked.ai; path=/; max-age=600; SameSite=Lax`;
    } catch (e) {
      console.warn('Failed to set cross-domain cookie:', e);
    }
    
    // Also store in localStorage as fallback
    localStorage.setItem('auth_redirect_origin', window.location.origin);
    
    // Redirect to Google OAuth endpoint with state parameter containing our origin
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.shrinked.ai';
    // Configure the redirect URL to point back to our callback handler
    const redirectUrl = `${window.location.origin}/api/auth/callback`;
    const state = encodeURIComponent(window.location.origin);
    window.location.href = `${baseUrl}/auth/google?redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`;
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setApiKey(null);
    
    // Clear localStorage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_api_key');
    localStorage.removeItem('auth_refresh_token');
  };

  const setUserData = (userData: User, token: string, key?: string) => {
    setUser(userData);
    setAccessToken(token);
    if (key) {
      setApiKey(key);
    }

    // Store in localStorage
    localStorage.setItem('auth_user', JSON.stringify(userData));
    localStorage.setItem('auth_access_token', token);
    if (key) {
      localStorage.setItem('auth_api_key', key);
    }
  };

  const value: AuthContextType = {
    user,
    accessToken,
    apiKey,
    isLoading,
    login,
    logout,
    setUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};