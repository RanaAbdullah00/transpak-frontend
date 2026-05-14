import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LoadingScreen from '../../components/ui/LoadingScreen.jsx';
import { dashboardPathForRole } from '../../utils/dashboardPath.js';
import Landing from './Landing.jsx';

/**
 * Public landing for guests; authenticated users go straight to role dashboard.
 */
const HomeEntry = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (user) {
    const activeRole = user.activeRole ?? user.roles?.[0];
    if (!activeRole) {
      return <Navigate to="/role" replace state={{ from: location.pathname || '/' }} />;
    }
    return <Navigate to={dashboardPathForRole(activeRole)} replace />;
  }

  return <Landing />;
};

export default HomeEntry;
