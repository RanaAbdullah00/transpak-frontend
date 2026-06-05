import React from 'react';
import { Route } from 'react-router-dom';
import AtomicRoute from '../components/routing/AtomicRoute.jsx';
import { ProtectedRoute } from './guards.jsx';
import Splash from '../pages/auth/Splash.jsx';
import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import VerifyEmail from '../pages/auth/VerifyEmail.jsx';
import ForgotPassword from '../pages/auth/ForgotPassword.jsx';
import ResetPassword from '../pages/auth/ResetPassword.jsx';
import RoleSelection from '../pages/auth/RoleSelection.jsx';
import About from '../pages/static/About.jsx';
import Contact from '../pages/static/Contact.jsx';
import HomeEntry from '../pages/landing/HomeEntry.jsx';

export const authRoutes = [
  <Route key="splash" path="/splash" element={<AtomicRoute name="splash"><Splash /></AtomicRoute>} />,
  <Route key="login" path="/login" element={<AtomicRoute name="login"><Login /></AtomicRoute>} />,
  <Route key="register" path="/register" element={<AtomicRoute name="register"><Register /></AtomicRoute>} />,
  <Route key="signup" path="/signup" element={<AtomicRoute name="signup"><Register /></AtomicRoute>} />,
  <Route key="verify-email" path="/verify-email" element={<AtomicRoute name="verify-email"><VerifyEmail /></AtomicRoute>} />,
  <Route key="forgot-password" path="/forgot-password" element={<AtomicRoute name="forgot-password"><ForgotPassword /></AtomicRoute>} />,
  <Route key="reset-password" path="/reset-password" element={<AtomicRoute name="reset-password"><ResetPassword /></AtomicRoute>} />,
  <Route key="about" path="/about" element={<AtomicRoute name="about"><About /></AtomicRoute>} />,
  <Route key="contact" path="/contact" element={<AtomicRoute name="contact"><Contact /></AtomicRoute>} />,
  <Route
    key="role"
    path="/role"
    element={
      <AtomicRoute name="role">
        <ProtectedRoute>
          <RoleSelection />
        </ProtectedRoute>
      </AtomicRoute>
    }
  />,
  <Route key="home" path="/" element={<AtomicRoute name="home"><HomeEntry /></AtomicRoute>} />
];
