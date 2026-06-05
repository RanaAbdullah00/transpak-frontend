import React, { useMemo, useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Navbar from './components/layout/Navbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import AdminSidebar from './components/layout/AdminSidebar.jsx';
import MobileNav from './components/layout/MobileNav.jsx';
import Footer from './components/layout/Footer.jsx';
import ReviewPromptHost from './components/reviews/ReviewPromptHost.jsx';
import SocketReconnectIndicator from './components/layout/SocketReconnectIndicator.jsx';
import RouteVerifier from './components/layout/RouteVerifier.jsx';
import DeployMismatchBanner from './components/layout/DeployMismatchBanner.jsx';
import RoleSwitchOverlay from './components/layout/RoleSwitchOverlay.jsx';
import AtomicRoute from './components/routing/AtomicRoute.jsx';
import { AppContext } from './context/AppContext.jsx';
import { resolveAdminShell } from './utils/rbac.js';
import { useAdminSessionBootstrap } from './hooks/useAdminSessionBootstrap.js';
import { authRoutes } from './routes/authRoutes.jsx';
import { dashboardRoutes } from './routes/dashboardRoutes.jsx';
import { adminRoutes } from './routes/adminRoutes.jsx';
import { commercialRoutes } from './routes/commercialRoutes.jsx';

const PAGE_BG_EXACT = {
  '/': 'landing',
  '/login': 'auth',
  '/register': 'auth',
  '/signup': 'auth',
  '/verify-email': 'auth',
  '/forgot-password': 'auth',
  '/reset-password': 'auth',
  '/splash': 'auth',
  '/about': 'auth',
  '/contact': 'auth'
};

function resolvePageBackground(pathname) {
  if (PAGE_BG_EXACT[pathname] != null) return PAGE_BG_EXACT[pathname];
  return 'unified';
}

function AppRealtimeChrome() {
  const app = useContext(AppContext);
  return (
    <>
      <SocketReconnectIndicator status={app?.socketStatus} />
      <ReviewPromptHost />
    </>
  );
}

function App() {
  const location = useLocation();
  const { user } = useAuth();
  useAdminSessionBootstrap();
  const roleRemountKey =
    user?.id && user?.activeRole ? `${user.id}:${user.activeRole}` : 'guest';
  const isAuthPage = ['/', '/login', '/register', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/splash', '/about', '/contact'].includes(
    location.pathname
  );
  const isBareAuthMain = ['/', '/login', '/register', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/splash', '/about', '/contact'].includes(
    location.pathname
  );
  const pageBg = useMemo(() => resolvePageBackground(location.pathname), [location.pathname]);
  const adminShell = resolveAdminShell(user, location.pathname);

  React.useEffect(() => {
    document.body.classList.toggle('tp-role-admin', adminShell);
    if (adminShell) {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
      document.body.classList.remove('tp-lang-ur');
    }
    return () => document.body.classList.remove('tp-role-admin');
  }, [adminShell]);

  return (
    <div className="app-root d-flex flex-column min-vh-100 tp-app-surface tp-app-root-vh">
      <DeployMismatchBanner />
      <RouteVerifier />
      {!isAuthPage && <Navbar key={`nav-${roleRemountKey}`} />}
      <div className="d-flex flex-grow-1 tp-app-main-row min-w-0">
        {!isAuthPage && (adminShell ? <AdminSidebar key={`aside-${roleRemountKey}`} /> : <Sidebar key={`side-${roleRemountKey}`} />)}
        <main
          className={`flex-grow-1 container-fluid px-0 pb-5 pb-md-0 tp-main-shell min-h-0 min-w-0${isBareAuthMain ? ' tp-main-shell--bare-auth' : ''}`}
          data-tp-page-bg={pageBg}
        >
          <Routes>
            {authRoutes}
            {dashboardRoutes}
            {adminRoutes}
            {commercialRoutes}
            <Route
              path="*"
              element={
                <AtomicRoute name="not-found">
                  <Navigate to="/" replace />
                </AtomicRoute>
              }
            />
          </Routes>
        </main>
      </div>
      {!isAuthPage && <MobileNav />}
      {!isAuthPage && <Footer />}
      {!isAuthPage ? <AppRealtimeChrome /> : null}
      <RoleSwitchOverlay />
    </div>
  );
}

export default App;
