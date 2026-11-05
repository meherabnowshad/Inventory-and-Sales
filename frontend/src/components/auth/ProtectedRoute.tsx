import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import { NoAccessPage } from '../../pages/NoAccessPage';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-800" />
      </div>
    );
  }

  // Not logged in -> send to login screen (FR-AUTH-03)
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check -> opening unauthorized URL directly shows no-access page (FR-AUTH-07)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <NoAccessPage />;
  }

  return <Outlet />;
}
