'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

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
  refreshToken: () => Promise<boolean>;
  refreshTokenIfNeeded: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Prevent multiple refresh attempts
  const refreshInProgress = useRef(false);


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
    
    // Refresh the page to reset the application state
    window.location.reload();
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

  // Helper function to check if token is about to expire (within 5 minutes)
  const isTokenExpiringSoon = (token: string): boolean => {
    try {
      // JWT tokens have payload as base64 encoded second part
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      return (exp - now) < fiveMinutes;
    } catch (error) {
      console.warn('[AuthContext] Could not parse token expiry:', error);
      return true; // Assume it's expiring to be safe
    }
  };

  const refreshToken = useCallback(async (): Promise<boolean> => {
    // Prevent multiple concurrent refresh attempts
    if (refreshInProgress.current) {
      console.log('[AuthContext] Refresh already in progress, skipping...');
      return false;
    }

    try {
      refreshInProgress.current = true;
      const storedRefreshToken = localStorage.getItem('auth_refresh_token');

      if (!storedRefreshToken) {
        console.error('[AuthContext] No refresh token available');
        return false;
      }

      console.log('[AuthContext] Attempting to refresh access token...');

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: storedRefreshToken
        }),
      });

      if (!response.ok) {
        console.error('[AuthContext] Token refresh failed:', response.status);
        // Only logout on 401/403 - not on network errors
        if (response.status === 401 || response.status === 403) {
          logout();
        }
        return false;
      }

      const data = await response.json();

      // Update tokens
      setAccessToken(data.accessToken);
      localStorage.setItem('auth_access_token', data.accessToken);
      localStorage.setItem('auth_refresh_token', data.refreshToken);

      console.log('[AuthContext] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[AuthContext] Error refreshing token:', error);
      // Don't logout on network errors - only on auth failures
      return false;
    } finally {
      refreshInProgress.current = false;
    }
  }, []);

  const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    // Check if we need to refresh proactively
    if (accessToken && !isTokenExpiringSoon(accessToken)) {
      return true; // Token is still valid, no refresh needed
    }

    console.log('[AuthContext] Token is expiring soon or expired, refreshing...');
    return await refreshToken();
  }, [accessToken, refreshToken]);

  // Periodic token refresh check (every 10 minutes - less aggressive)
  useEffect(() => {
    if (!user || !accessToken) return;

    const interval = setInterval(() => {
      refreshTokenIfNeeded().catch(error => {
        console.error('[AuthContext] Periodic refresh check failed:', error);
      });
    }, 10 * 60 * 1000); // 10 minutes instead of 4

    return () => clearInterval(interval);
  }, [user, accessToken, refreshTokenIfNeeded]);

  // Refresh token when user returns to the tab after being away (throttled)
  useEffect(() => {
    if (!user || !accessToken) return;

    let lastFocusCheck = 0;
    const handleFocus = () => {
      const now = Date.now();
      // Only check on focus if it's been more than 2 minutes since last check
      if (now - lastFocusCheck < 2 * 60 * 1000) {
        console.log('[AuthContext] Tab focus ignored - too recent');
        return;
      }
      lastFocusCheck = now;
      console.log('[AuthContext] Tab regained focus, checking token freshness...');
      refreshTokenIfNeeded().catch(error => {
        console.error('[AuthContext] Focus refresh check failed:', error);
      });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, accessToken, refreshTokenIfNeeded]);

  const value: AuthContextType = {
    user,
    accessToken,
    apiKey,
    isLoading,
    login,
    logout,
    setUserData,
    refreshToken,
    refreshTokenIfNeeded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};