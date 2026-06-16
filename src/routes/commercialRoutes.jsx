import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import AtomicRoute from '../components/routing/AtomicRoute.jsx';
import { ProtectedRoute } from './guards.jsx';
import {
  LoadsHub,
  LoadDetails,
  BidManagement,
  MyBids,
  ShipmentTracking,
  Messages,
  TruckDetails,
  PublicProfile
} from './lazyPages.js';
import PostLoad from '../pages/loads/PostLoad.jsx';
import PostCarrierSpace from '../pages/carrier/PostCarrierSpace.jsx';
import EditLoad from '../pages/loads/EditLoad.jsx';
import PlaceBid from '../pages/bids/PlaceBid.jsx';
import ApproveCarrier from '../pages/bids/ApproveCarrier.jsx';
import AcceptedLoads from '../pages/loads/AcceptedLoads.jsx';
import FleetMonitoring from '../pages/fleet/FleetMonitoring.jsx';
import AddTruck from '../pages/fleet/AddTruck.jsx';
import CarrierVerification from '../pages/auth/CarrierVerification.jsx';
import ShipmentHistory from '../pages/shipments/ShipmentHistory.jsx';
import ShipmentsActive from '../pages/shipments/ShipmentsActive.jsx';
import Profile from '../pages/profile/Profile.jsx';
import Settings from '../pages/settings/Settings.jsx';
import Support from '../pages/support/Support.jsx';
import Feedback from '../pages/support/Feedback.jsx';
import Notifications from '../pages/notifications/Notifications.jsx';
import OperationsActivity from '../pages/operations/OperationsActivity.jsx';

function commercial(name, children) {
  return <AtomicRoute name={name}>{children}</AtomicRoute>;
}

function protectedCommercial(name, children, allowedRoles) {
  return commercial(name, <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>);
}

export const commercialRoutes = [
  <Route key="loads-post" path="/loads/post" element={protectedCommercial('loads-post', <PostLoad />, ['shipper'])} />,
  <Route key="loads-manage" path="/loads/manage" element={protectedCommercial('loads-manage', <LoadsHub />, ['shipper', 'carrier'])} />,
  <Route key="carrier-space-post" path="/carrier/space/post" element={protectedCommercial('carrier-space-post', <PostCarrierSpace />, ['carrier'])} />,
  <Route
    key="loads-redirect"
    path="/loads"
    element={protectedCommercial(
      'loads-redirect',
      <Navigate to="/loads/manage?tab=marketplace&sub=loads" replace />,
      ['carrier']
    )}
  />,
  <Route key="loads-accepted" path="/loads/accepted" element={protectedCommercial('loads-accepted', <AcceptedLoads />, ['carrier'])} />,
  <Route key="loads-edit" path="/loads/:id/edit" element={protectedCommercial('loads-edit', <EditLoad />, ['shipper'])} />,
  <Route key="loads-detail" path="/loads/:id" element={commercial('loads-detail', <ProtectedRoute><LoadDetails /></ProtectedRoute>)} />,
  <Route key="bids" path="/bids" element={protectedCommercial('bids', <BidManagement />, ['shipper'])} />,
  <Route key="bids-mine" path="/bids/mine" element={protectedCommercial('bids-mine', <MyBids />, ['carrier'])} />,
  <Route key="bids-place" path="/bids/place" element={protectedCommercial('bids-place', <PlaceBid />, ['carrier'])} />,
  <Route key="bids-approve" path="/bids/approve" element={protectedCommercial('bids-approve', <ApproveCarrier />, ['shipper'])} />,
  <Route key="fleet" path="/fleet" element={protectedCommercial('fleet', <FleetMonitoring />, ['carrier'])} />,
  <Route key="carrier-truck-details" path="/carrier/truck-details" element={protectedCommercial('carrier-truck-details', <TruckDetails />, ['carrier'])} />,
  <Route key="carrier-verification" path="/carrier/verification" element={protectedCommercial('carrier-verification', <CarrierVerification />, ['carrier'])} />,
  <Route key="carrier-trust-redirect" path="/carrier/trust" element={<Navigate to="/carrier/verification" replace />} />,
  <Route key="fleet-add" path="/fleet/add" element={protectedCommercial('fleet-add', <AddTruck />, ['carrier'])} />,
  <Route key="shipments-active" path="/shipments/active" element={protectedCommercial('shipments-active', <ShipmentsActive />, ['shipper', 'carrier'])} />,
  <Route key="shipments-tracking" path="/shipments/tracking/:trackId?" element={protectedCommercial('shipments-tracking', <ShipmentTracking />, ['shipper', 'carrier'])} />,
  <Route key="shipments-history" path="/shipments/history" element={protectedCommercial('shipments-history', <ShipmentHistory />, ['shipper', 'carrier'])} />,
  <Route key="profile" path="/profile" element={commercial('profile', <ProtectedRoute><Profile /></ProtectedRoute>)} />,
  <Route key="settings" path="/settings" element={commercial('settings', <ProtectedRoute><Settings /></ProtectedRoute>)} />,
  <Route key="support" path="/support" element={commercial('support', <ProtectedRoute><Support /></ProtectedRoute>)} />,
  <Route key="feedback" path="/feedback" element={commercial('feedback', <ProtectedRoute><Feedback /></ProtectedRoute>)} />,
  <Route key="notifications" path="/notifications" element={commercial('notifications', <ProtectedRoute><Notifications /></ProtectedRoute>)} />,
  <Route
    key="operations-activity"
    path="/operations/activity"
    element={protectedCommercial('operations-activity', <OperationsActivity />, ['shipper', 'carrier', 'admin'])}
  />,
  <Route key="messages" path="/messages" element={commercial('messages', <ProtectedRoute><Messages /></ProtectedRoute>)} />,
  <Route key="public-profile" path="/profile/u/:id" element={commercial('public-profile', <ProtectedRoute><PublicProfile /></ProtectedRoute>)} />
];
