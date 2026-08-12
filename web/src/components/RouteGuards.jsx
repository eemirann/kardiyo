import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

/** Giris gerektiren sayfalar. */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Oturum kontrol ediliyor…" />;
  if (!user) return <Navigate to="/giris" state={{ from: location.pathname }} replace />;
  return children;
}

/** Yalnizca yoneticiler. */
export function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Yetki kontrol ediliyor…" />;
  if (!user) return <Navigate to="/giris" state={{ from: location.pathname }} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
