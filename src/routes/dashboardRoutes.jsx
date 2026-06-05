import React from 'react';
import { Route } from 'react-router-dom';
import AtomicRoute from '../components/routing/AtomicRoute.jsx';
import { ProtectedRoute, RoleDashboard } from './guards.jsx';
import { ShipperDashboard, CarrierDashboard } from './lazyPages.js';

export default function DashboardRoutes() {
  return (
    <>
      <Route
        path="/dashboard"
        element={
          <AtomicRoute name="dashboard">
            <ProtectedRoute>
              <RoleDashboard />
            </ProtectedRoute>
          </AtomicRoute>
        }
      />
      <Route
        path="/dashboard/shipper"
        element={
          <AtomicRoute name="dashboard-shipper">
            <ProtectedRoute allowedRoles={['shipper']}>
              <ShipperDashboard />
            </ProtectedRoute>
          </AtomicRoute>
        }
      />
      <Route
        path="/dashboard/carrier"
        element={
          <AtomicRoute name="dashboard-carrier">
            <ProtectedRoute allowedRoles={['carrier']}>
              <CarrierDashboard />
            </ProtectedRoute>
          </AtomicRoute>
        }
      />
    </>
  );
}
