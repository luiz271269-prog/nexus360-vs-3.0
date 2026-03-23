import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoadingPublicSettings(true);
        setIsLoadingAuth(true);

        try {
          // Timeout de 8s para evitar spinner infinito
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('auth_timeout')), 8000)
          );
          const currentUser = await Promise.race([base44.auth.me(), timeoutPromise]);
          setUser(currentUser);
          setIsAuthenticated(true);
          setAuthError(null);
        } catch (error) {
          if (error?.message === 'auth_timeout') {
            setAuthError({ type: 'auth_required', message: 'Timeout' });
          } else if (error?.response?.status === 401 || error?.message?.includes('not registered')) {
            setAuthError({ type: 'user_not_registered', message: error.message });
          } else {
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          }
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('[AUTH] Error:', error);
        setAuthError({ type: 'settings_error', message: error.message });
      } finally {
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const navigateToLogin = () => {
    try {
      base44.auth.redirectToLogin(window.location.pathname);
    } catch (error) {
      console.error('[AUTH] Error redirecting to login:', error);
    }
  };

  const logout = async () => {
    try {
      await base44.auth.logout();
      setIsAuthenticated(false);
      setUser(null);
      setAuthError(null);
    } catch (error) {
      console.error('[AUTH] Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        user,
        navigateToLogin,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};