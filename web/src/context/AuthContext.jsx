import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sayfa acilisinda refresh cookie'si varsa oturumu geri getir
  useEffect(() => {
    let cancelled = false;
    api
      .refreshSession()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Kayit oturum ACMAZ: hesap, e-postadaki bag tiklanana kadar bekler.
   * Cagiran sayfa "dogrulama baglantisi gonderildi" ekranini gosterir.
   */
  const register = useCallback(
    (fullName, email, password) => api.post('/auth/register', { fullName, email, password }),
    []
  );

  /** E-postadaki bagi harcar; basarili olursa oturumu da acar. */
  const verifyEmail = useCallback(async (token) => {
    const data = await api.post('/auth/verify-email', { token });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const resendVerification = useCallback(
    (email) => api.post('/auth/resend-verification', { email }),
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // cikis her durumda yerelde uygulanir
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  /** Puan/rozet degisiminde kullanici bilgisini tazeler. */
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      // sessizce gec
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      verifyEmail,
      resendVerification,
      logout,
      refreshUser,
      setUser,
      isAdmin: user?.role === 'admin',
      isPremium: Boolean(user?.isPremium) || user?.role === 'admin',
    }),
    [user, loading, login, register, verifyEmail, resendVerification, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider icinde kullanilmali');
  return ctx;
}
