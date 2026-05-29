import React, { Suspense, useMemo, useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Splash from './pages/auth/Splash.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import RoleSelection from './pages/auth/RoleSelection.jsx';
import {
  ShipperDashboard,
  CarrierDashboard,
  AdminDashboardPage,
  AdminUsers,
  AdminLoads,
  AdminBids,
  AdminNotifications,
  AdminOtpLogs,
  AdminRoleManagement,
  VerificationQueue,
  AdminFleetQueue,
  Disputes,
  ShipmentControl,
  LoadsHub,
  LoadDetails,
  BidManagement,
  MyBids,
  ShipmentTracking,
  Messages,
  TruckDetails,
  PublicProfile
} from './routes/lazyPages.js';
import PostLoad from './pages/loads/PostLoad.jsx';
import PostCarrierSpace from './pages/carrier/PostCarrierSpace.jsx';
import EditLoad from './pages/loads/EditLoad.jsx';
import PlaceBid from './pages/bids/PlaceBid.jsx';
import ApproveCarrier from './pages/bids/ApproveCarrier.jsx';
import AcceptedLoads from './pages/loads/AcceptedLoads.jsx';
import FleetMonitoring from './pages/fleet/FleetMonitoring.jsx';
import AddTruck from './pages/fleet/AddTruck.jsx';
import CarrierVerification from './pages/auth/CarrierVerification.jsx';
import ShipmentHistory from './pages/shipments/ShipmentHistory.jsx';
import Profile from './pages/profile/Profile.jsx';
import Settings from './pages/settings/Settings.jsx';
import Support from './pages/support/Support.jsx';
import Feedback from './pages/support/Feedback.jsx';
import Notifications from './pages/notifications/Notifications.jsx';
import About from './pages/static/About.jsx';
import Contact from './pages/static/Contact.jsx';
import HomeEntry from './pages/landing/HomeEntry.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import AdminSidebar from './components/layout/AdminSidebar.jsx';
import MobileNav from './components/layout/MobileNav.jsx';
import Footer from './components/layout/Footer.jsx';
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import ReviewPromptHost from './components/reviews/ReviewPromptHost.jsx';
import SocketReconnectIndicator from './components/layout/SocketReconnectIndicator.jsx';
import RouteVerifier from './components/layout/RouteVerifier.jsx';
import DeployMismatchBanner from './components/layout/DeployMismatchBanner.jsx';
import RoleSwitchOverlay from './components/layout/RoleSwitchOverlay.jsx';
import { AppContext } from './context/AppContext.jsx';
import { dashboardPathForRole } from './utils/dashboardPath.js';
import { canAccessAdminRoutes, resolveAdminShell, shouldUseAdminShell } from './utils/rbac.js';
import { useAdminSessionBootstrap } from './hooks/useAdminSessionBootstrap.js';
import AdminErrorBoundary from './components/admin/AdminErrorBoundary.jsx';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const activeRole = user.activeRole ?? user.roles?.[0];
  if (!activeRole) return <Navigate to="/role" replace state={{ from: location.pathname }} />;

  if (
    shouldUseAdminShell(user) &&
    allowedRoles &&
    !allowedRoles.includes('admin') &&
    !canAccessAdminRoutes(user)
  ) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const path = location.pathname;
  const adminExtras = ['/profile', '/settings', '/support', '/feedback', '/about', '/contact'];
  const adminPathOk =
    path.startsWith('/admin') ||
    adminExtras.some((p) => path === p || path.startsWith(`${p}/`));
  if (shouldUseAdminShell(user) && !adminPathOk) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const accountRoles = Array.isArray(user.roles) ? user.roles : [];
  if (allowedRoles?.includes('admin') && !canAccessAdminRoutes(user)) {
    return <Navigate to={dashboardPathForRole(activeRole === 'admin' ? 'shipper' : activeRole)} replace />;
  }
  if (allowedRoles && !allowedRoles.some((r) => accountRoles.includes(r))) {
    const fallback =
      allowedRoles.includes('admin') && accountRoles.includes('admin')
        ? 'admin'
        : activeRole;
    return <Navigate to={dashboardPathForRole(fallback)} replace />;
  }

  return children;
};

const RoleDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  const activeRole = user.activeRole ?? user.roles?.[0];
  if (!activeRole) return <Navigate to="/role" replace state={{ from: location.pathname }} />;
  return <Navigate to={dashboardPathForRole(activeRole)} replace />;
};

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
      <SocketReconnectIndicator socket={app?.getSocket?.()} />
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
    <>

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
              <Suspense fallback={<LoadingScreen />} key={roleRemountKey}>
              <AdminErrorBoundary key={adminShell ? `admin-eb-${roleRemountKey}` : 'commercial'}>
              <Routes>
              {/* Auth */}
              <Route path="/splash" element={<Splash />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/signup" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route
                path="/role"
                element={
                  <ProtectedRoute>
                    <RoleSelection />
                  </ProtectedRoute>
                }
              />

              {/* Public home + authed redirect */}
              <Route path="/" element={<HomeEntry />} />

              {/* Dashboards */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <RoleDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/shipper"
                element={
                  <ProtectedRoute allowedRoles={['shipper']}>
                    <ShipperDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/carrier"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <CarrierDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/dashboard/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/roles"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminRoleManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/loads"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLoads />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/verification"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <VerificationQueue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/fleet"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminFleetQueue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/disputes"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Disputes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/shipments"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ShipmentControl />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/bids"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminBids />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/notifications"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminNotifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/otp-logs"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminOtpLogs />
                  </ProtectedRoute>
                }
              />

              {/* Loads */}
              <Route
                path="/loads/post"
                element={
                  <ProtectedRoute allowedRoles={['shipper']}>
                    <PostLoad />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loads/manage"
                element={
                  <ProtectedRoute allowedRoles={['shipper', 'carrier']}>
                    <LoadsHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/carrier/space/post"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <PostCarrierSpace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loads"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <LoadsHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loads/accepted"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <AcceptedLoads />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loads/:id/edit"
                element={
                  <ProtectedRoute allowedRoles={['shipper']}>
                    <EditLoad />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loads/:id"
                element={
                  <ProtectedRoute>
                    <LoadDetails />
                  </ProtectedRoute>
                }
              />

              {/* Bids */}
              <Route
                path="/bids"
                element={
                  <ProtectedRoute allowedRoles={['shipper']}>
                    <BidManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bids/mine"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <MyBids />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bids/place"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <PlaceBid />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bids/approve"
                element={
                  <ProtectedRoute allowedRoles={['shipper']}>
                    <ApproveCarrier />
                  </ProtectedRoute>
                }
              />

              {/* Fleet */}
              <Route
                path="/fleet"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <FleetMonitoring />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/carrier/truck-details"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <TruckDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/carrier/verification"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <CarrierVerification />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fleet/add"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <AddTruck />
                  </ProtectedRoute>
                }
              />

              {/* Shipments */}
              <Route
                path="/shipments/tracking/:trackId?"
                element={
                  <ProtectedRoute allowedRoles={['shipper', 'carrier', 'admin']}>
                    <ShipmentTracking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shipments/history"
                element={
                  <ProtectedRoute allowedRoles={['shipper', 'carrier', 'admin']}>
                    <ShipmentHistory />
                  </ProtectedRoute>
                }
              />

              {/* Shared */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/support"
                element={
                  <ProtectedRoute>
                    <Support />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feedback"
                element={
                  <ProtectedRoute>
                    <Feedback />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <Messages />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile/u/:id"
                element={
                  <ProtectedRoute>
                    <PublicProfile />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </AdminErrorBoundary>
              </Suspense>
          </main>
        </div>
        {!isAuthPage && <MobileNav />}
        {!isAuthPage && <Footer />}
        {!isAuthPage ? <AppRealtimeChrome /> : null}
        <RoleSwitchOverlay />
      </div>
    </>
  );
}

export default App;
// deploy sync fix