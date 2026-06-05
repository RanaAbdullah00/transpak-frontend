import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import AtomicRoute from '../components/routing/AtomicRoute.jsx';
import { ProtectedRoute } from './guards.jsx';
import {
  AdminDashboardPage,
  AdminUsers,
  AdminLoads,
  AdminBids,
  AdminNotifications,
  AdminRoleManagement,
  AdminFleetQueue,
  Disputes,
  ShipmentControl
} from './lazyPages.js';

function adminRoute(name, element) {
  return (
    <AtomicRoute name={name} admin>
      <ProtectedRoute allowedRoles={['admin']}>{element}</ProtectedRoute>
    </AtomicRoute>
  );
}

export const adminRoutes = [
  <Route
    key="dashboard-admin-redirect"
    path="/dashboard/admin"
    element={
      <AtomicRoute name="dashboard-admin-redirect">
        <Navigate to="/admin/dashboard" replace />
      </AtomicRoute>
    }
  />,
  <Route key="admin-dashboard" path="/admin/dashboard" element={adminRoute('admin-dashboard', <AdminDashboardPage />)} />,
  <Route key="admin-users" path="/admin/users" element={adminRoute('admin-users', <AdminUsers />)} />,
  <Route key="admin-roles" path="/admin/roles" element={adminRoute('admin-roles', <AdminRoleManagement />)} />,
  <Route key="admin-loads" path="/admin/loads" element={adminRoute('admin-loads', <AdminLoads />)} />,
  <Route
    key="admin-verification-redirect"
    path="/admin/verification"
    element={
      <AtomicRoute name="admin-verification-redirect">
        <Navigate to="/admin/dashboard" replace />
      </AtomicRoute>
    }
  />,
  <Route
    key="admin-otp-logs-redirect"
    path="/admin/otp-logs"
    element={
      <AtomicRoute name="admin-otp-logs-redirect">
        <Navigate to="/admin/dashboard" replace />
      </AtomicRoute>
    }
  />,
  <Route key="admin-fleet" path="/admin/fleet" element={adminRoute('admin-fleet', <AdminFleetQueue />)} />,
  <Route key="admin-disputes" path="/admin/disputes" element={adminRoute('admin-disputes', <Disputes />)} />,
  <Route key="admin-shipments" path="/admin/shipments" element={adminRoute('admin-shipments', <ShipmentControl />)} />,
  <Route key="admin-bids" path="/admin/bids" element={adminRoute('admin-bids', <AdminBids />)} />,
  <Route key="admin-notifications" path="/admin/notifications" element={adminRoute('admin-notifications', <AdminNotifications />)} />
];
