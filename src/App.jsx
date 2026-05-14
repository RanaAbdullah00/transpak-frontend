import { useMemo } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Splash from './pages/auth/Splash.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import RoleSelection from './pages/auth/RoleSelection.jsx';
import ShipperDashboard from './pages/dashboard/ShipperDashboard.jsx';
import CarrierDashboard from './pages/dashboard/CarrierDashboard.jsx';
import AdminDashboard from './pages/dashboard/AdminDashboard.jsx';
import VerificationQueue from './pages/admin/VerificationQueue.jsx';
import Disputes from './pages/admin/Disputes.jsx';
import ShipmentControl from './pages/admin/ShipmentControl.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminLoads from './pages/admin/AdminLoads.jsx';
import AdminRoleManagement from './pages/admin/AdminRoleManagement.jsx';
import PostLoad from './pages/loads/PostLoad.jsx';
import ManageLoads from './pages/loads/ManageLoads.jsx';
import AvailableLoads from './pages/loads/AvailableLoads.jsx';
import LoadDetails from './pages/loads/LoadDetails.jsx';
import EditLoad from './pages/loads/EditLoad.jsx';
import BidManagement from './pages/bids/BidManagement.jsx';
import PlaceBid from './pages/bids/PlaceBid.jsx';
import ApproveCarrier from './pages/bids/ApproveCarrier.jsx';
import MyBids from './pages/bids/MyBids.jsx';
import AcceptedLoads from './pages/loads/AcceptedLoads.jsx';
import FleetMonitoring from './pages/fleet/FleetMonitoring.jsx';
import AddTruck from './pages/fleet/AddTruck.jsx';
import TruckDetails from './pages/carrier/TruckDetails.jsx';
import CarrierVerification from './pages/auth/CarrierVerification.jsx';
import ShipmentTracking from './pages/shipments/ShipmentTracking.jsx';
import ShipmentHistory from './pages/shipments/ShipmentHistory.jsx';
import Profile from './pages/profile/Profile.jsx';
import Settings from './pages/settings/Settings.jsx';
import Support from './pages/support/Support.jsx';
import Feedback from './pages/support/Feedback.jsx';
import Notifications from './pages/notifications/Notifications.jsx';
import Messages from './pages/messages/Messages.jsx';
import About from './pages/static/About.jsx';
import Contact from './pages/static/Contact.jsx';
import HomeEntry from './pages/landing/HomeEntry.jsx';
import Navbar from './components/layout/Navbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import MobileNav from './components/layout/MobileNav.jsx';
import Footer from './components/layout/Footer.jsx';
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import { dashboardPathForRole } from './utils/dashboardPath.js';

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

  if (allowedRoles && !allowedRoles.includes(activeRole)) {
    return <Navigate to={dashboardPathForRole(activeRole)} replace />;
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

function App() {
  const location = useLocation();
  const isAuthPage = ['/', '/login', '/register', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/splash', '/about', '/contact'].includes(
    location.pathname
  );
  const isBareAuthMain = ['/', '/login', '/register', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/splash', '/about', '/contact'].includes(
    location.pathname
  );
  const pageBg = useMemo(() => resolvePageBackground(location.pathname), [location.pathname]);
  return (
    <>

      <div className="app-root d-flex flex-column min-vh-100 tp-app-surface tp-app-root-vh">
        {!isAuthPage && <Navbar />}
        <div className="d-flex flex-grow-1 tp-app-main-row min-w-0">
          {!isAuthPage && <Sidebar />}
          <main
            className={`flex-grow-1 container-fluid px-0 pb-5 pb-md-0 tp-main-shell min-h-0 min-w-0${isBareAuthMain ? ' tp-main-shell--bare-auth' : ''}`}
            data-tp-page-bg={pageBg}
          >
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
              <Route
                path="/dashboard/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
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
                  <ProtectedRoute allowedRoles={['shipper']}>
                    <ManageLoads />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/loads"
                element={
                  <ProtectedRoute allowedRoles={['carrier']}>
                    <AvailableLoads />
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
                  <ProtectedRoute allowedRoles={['shipper', 'carrier']}>
                    <ShipmentTracking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shipments/history"
                element={
                  <ProtectedRoute allowedRoles={['shipper', 'carrier']}>
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

              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
          </main>
        </div>
        {!isAuthPage && <MobileNav />}
        {!isAuthPage && <Footer />}
      </div>
    </>
  );
}

export default App;

