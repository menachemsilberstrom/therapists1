import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

/**
 * UX-only guard: it just avoids showing a page the user can't use.
 * The real protection is the server, which verifies the JWT and the role (from the database) on every request.
 * Pass `roles` to restrict a group of routes (e.g. the admin panel) to certain roles.
 */
export default function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
