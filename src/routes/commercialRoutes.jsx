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
import Profile from '../pages/profile/Profile.jsx';
import Settings from '../pages/settings/Settings.jsx';
import Support from '../pages/support/Support.jsx';
import Feedback from '../pages/support/Feedback.jsx';
import Notifications from '../pages/notifications/Notifications.jsx';

function commercial(name, children) {
  return <AtomicRoute name={name}>{children}</AtomicRoute>;
}

function protectedCommercial(name, children, allowedRoles) {
  return commercial(name, <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>);
}

export default function CommercialRoutes() {
  return (
    <>
      <Route path="/loads/post" element={protectedCommercial('loads-post', <PostLoad />, ['shipper'])} />
      <Route path="/loads/manage" element={protectedCommercial('loads-manage', <LoadsHub />, ['shipper', 'carrier'])} />
      <Route path="/carrier/space/post" element={protectedCommercial('carrier-space-post', <PostCarrierSpace />, ['carrier'])} />
      <Route
        path="/loads"
        element={protectedCommercial(
          'loads-redirect',
          <Navigate to="/loads/manage?tab=freight" replace />,
          ['carrier']
        )}
      />
      <Route path="/loads/accepted" element={protectedCommercial('loads-accepted', <AcceptedLoads />, ['carrier'])} />
      <Route path="/loads/:id/edit" element={protectedCommercial('loads-edit', <EditLoad />, ['shipper'])} />
      <Route path="/loads/:id" element={commercial('loads-detail', <ProtectedRoute><LoadDetails /></ProtectedRoute>)} />

      <Route path="/bids" element={protectedCommercial('bids', <BidManagement />, ['shipper'])} />
      <Route path="/bids/mine" element={protectedCommercial('bids-mine', <MyBids />, ['carrier'])} />
      <Route path="/bids/place" element={protectedCommercial('bids-place', <PlaceBid />, ['carrier'])} />
      <Route path="/bids/approve" element={protectedCommercial('bids-approve', <ApproveCarrier />, ['shipper'])} />

      <Route path="/fleet" element={protectedCommercial('fleet', <FleetMonitoring />, ['carrier'])} />
      <Route path="/carrier/truck-details" element={protectedCommercial('carrier-truck-details', <TruckDetails />, ['carrier'])} />
      <Route path="/carrier/verification" element={protectedCommercial('carrier-verification', <CarrierVerification />, ['carrier'])} />
      <Route path="/fleet/add" element={protectedCommercial('fleet-add', <AddTruck />, ['carrier'])} />

      <Route path="/shipments/tracking/:trackId?" element={protectedCommercial('shipments-tracking', <ShipmentTracking />, ['shipper', 'carrier'])} />
      <Route path="/shipments/history" element={protectedCommercial('shipments-history', <ShipmentHistory />, ['shipper', 'carrier'])} />

      <Route path="/profile" element={commercial('profile', <ProtectedRoute><Profile /></ProtectedRoute>)} />
      <Route path="/settings" element={commercial('settings', <ProtectedRoute><Settings /></ProtectedRoute>)} />
      <Route path="/support" element={commercial('support', <ProtectedRoute><Support /></ProtectedRoute>)} />
      <Route path="/feedback" element={commercial('feedback', <ProtectedRoute><Feedback /></ProtectedRoute>)} />
      <Route path="/notifications" element={commercial('notifications', <ProtectedRoute><Notifications /></ProtectedRoute>)} />
      <Route path="/messages" element={commercial('messages', <ProtectedRoute><Messages /></ProtectedRoute>)} />
      <Route path="/profile/u/:id" element={commercial('public-profile', <ProtectedRoute><PublicProfile /></ProtectedRoute>)} />
    </>
  );
}
