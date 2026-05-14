import api from './api.js';

// Auth-related API calls.
export const loginApi = (credentials) =>
  api.post('/auth/login', credentials);

export const registerApi = (payload) =>
  api.post('/auth/register', payload);

export const addRoleApi = (role) => api.post('/auth/add-role', { role });

export const verifyRegisterOtpApi = (payload) => api.post('/auth/otp/register/verify', payload);

export const resendRegisterOtpApi = (payload) => api.post('/auth/otp/register/resend', payload);

export const sendForgotPasswordOtpApi = (payload) => api.post('/auth/otp/forgot/send', payload);

export const resetPasswordWithOtpApi = (payload) => api.post('/auth/otp/forgot/reset', payload);
