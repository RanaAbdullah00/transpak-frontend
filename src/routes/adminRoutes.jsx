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

export default function AdminRoutes() {
  return (
    <>
      <Route
        path="/dashboard/admin"
        element={
          <AtomicRoute name="dashboard-admin-redirect">
            <Navigate to="/admin/dashboard" replace />
          </AtomicRoute>
        }
      />
      <Route path="/admin/dashboard" element={adminRoute('admin-dashboard', <AdminDashboardPage />)} />
      <Route path="/admin/users" element={adminRoute('admin-users', <AdminUsers />)} />
      <Route path="/admin/roles" element={adminRoute('admin-roles', <AdminRoleManagement />)} />
      <Route path="/admin/loads" element={adminRoute('admin-loads', <AdminLoads />)} />
      <Route
        path="/admin/verification"
        element={
          <AtomicRoute name="admin-verification-redirect">
            <Navigate to="/admin/dashboard" replace />
          </AtomicRoute>
        }
      />
      <Route
        path="/admin/otp-logs"
        element={
          <AtomicRoute name="admin-otp-logs-redirect">
            <Navigate to="/admin/dashboard" replace />
          </AtomicRoute>
        }
      />
      <Route path="/admin/fleet" element={adminRoute('admin-fleet', <AdminFleetQueue />)} />
      <Route path="/admin/disputes" element={adminRoute('admin-disputes', <Disputes />)} />
      <Route path="/admin/shipments" element={adminRoute('admin-shipments', <ShipmentControl />)} />
      <Route path="/admin/bids" element={adminRoute('admin-bids', <AdminBids />)} />
      <Route path="/admin/notifications" element={adminRoute('admin-notifications', <AdminNotifications />)} />
    </>
  );
}
