import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';
import {
  isFirebaseConfigured,
  signInWithFirebase,
  signOutFromFirebase,
  sendResetPasswordWithFirebase,
  subscribeToFirebaseAuthState,
  getFreshFirebaseIdToken
} from '../config/firebase.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cliniccare_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and verify session against backend
  const verifySession = useCallback(async () => {
    const savedToken = localStorage.getItem('cliniccare_token');
    if (!savedToken) {
      setUser(null);
      setClinic(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.auth.getMe();
      setUser(data.user);
      setClinic(data.clinic);
    } catch (err) {
      console.warn('Session verification failed, logging out:', err.message);
      localStorage.removeItem('cliniccare_token');
      setToken(null);
      setUser(null);
      setClinic(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = null;

    if (isFirebaseConfigured) {
      // Listen to real-time Firebase Auth state changes
      unsubscribe = subscribeToFirebaseAuthState(async (fbUser) => {
        if (fbUser) {
          try {
            const freshToken = await fbUser.getIdToken();
            localStorage.setItem('cliniccare_token', freshToken);
            setToken(freshToken);

            const data = await api.auth.getMe();
            setUser(data.user);
            setClinic(data.clinic);
          } catch (err) {
            console.warn('Failed to synchronize Firebase session with backend:', err.message);
          } finally {
            setIsLoading(false);
          }
        } else {
          // Firebase signed out or no active Firebase user
          const existingToken = localStorage.getItem('cliniccare_token');
          if (existingToken && (existingToken.startsWith('dev-') || existingToken.startsWith('mock-'))) {
            // Local dev / test token mode
            verifySession();
          } else {
            setUser(null);
            setClinic(null);
            setToken(null);
            localStorage.removeItem('cliniccare_token');
            setIsLoading(false);
          }
        }
      });
    } else {
      // Local dev / fallback mode
      verifySession();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [verifySession]);

  /**
   * Authenticate user with Firebase Auth or fallback
   */
  const login = async (credentials) => {
    setIsLoading(true);
    try {
      let authToken = null;
      let loginResponse = null;

      if (isFirebaseConfigured) {
        try {
          // Step 1: Client signs into Firebase Auth
          const { idToken } = await signInWithFirebase(credentials.email, credentials.password);
          authToken = idToken;

          // Step 2: Send ID token to backend for role resolution & audit logging
          loginResponse = await api.auth.login({
            idToken,
            email: credentials.email,
            role: credentials.role
          });
        } catch (fbErr) {
          console.warn('Firebase client login error, trying backend:', fbErr.message);
          // If Firebase client fails with invalid credentials, check if it's a specific auth error
          if (fbErr.code && fbErr.code.startsWith('auth/')) {
            throw fbErr;
          }
          // Fallback to direct API login
          loginResponse = await api.auth.login(credentials);
          authToken = loginResponse.token;
        }
      } else {
        // Local mode login
        loginResponse = await api.auth.login(credentials);
        authToken = loginResponse.token;
      }

      localStorage.setItem('cliniccare_token', authToken);
      setToken(authToken);
      setUser(loginResponse.user);

      // Fetch clinic settings
      const meData = await api.auth.getMe();
      setClinic(meData.clinic);
      return loginResponse.user;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign out and clear credentials
   */
  const logout = async () => {
    try {
      await signOutFromFirebase();
    } catch (err) {
      console.warn('Firebase sign-out notice:', err.message);
    }
    localStorage.removeItem('cliniccare_token');
    setToken(null);
    setUser(null);
    setClinic(null);
  };

  /**
   * Send password reset
   */
  const resetPassword = async (email) => {
    if (isFirebaseConfigured) {
      try {
        await sendResetPasswordWithFirebase(email);
        return { message: `Password reset email dispatched to ${email}` };
      } catch (fbErr) {
        console.warn('Firebase client reset failed, fallback to backend:', fbErr.message);
      }
    }
    return await api.auth.resetPassword(email);
  };

  const updateClinicState = (updatedClinic) => {
    setClinic(updatedClinic);
  };

  const value = {
    user,
    clinic,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(user && token),
    isLoading,
    isFirebaseConfigured,
    login,
    logout,
    resetPassword,
    refreshProfile: verifySession,
    updateClinicState
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
