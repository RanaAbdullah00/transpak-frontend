import React from 'react';
import { createPortal } from 'react-dom';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getPortalContainer } from '../../utils/portalRoot.js';

// Module-level toast utilities
export const notifySuccess = (message) =>
  toast.success(message, {
    position: 'top-right',
    autoClose: 4000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: 'colored'
  });

export const notifyError = (message) =>
  toast.error(message, {
    position: 'top-right',
    autoClose: 5000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: 'colored'
  });

export const notifyInfo = (message) =>
  toast.info(message, {
    position: 'top-right',
    autoClose: 4000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: 'colored'
  });

export { toast };

function TpToastContainer() {
  const { isUrdu } = useLanguage();
  const host = getPortalContainer();
  if (!host) return null;
  return createPortal(
    <ToastContainer
      containerId="tp-toastify"
      position="top-right"
      autoClose={4000}
      hideProgressBar={true}
      newestOnTop
      closeOnClick
      rtl={isUrdu}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
      transition={Slide}
      className="tp-toast-host"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '400px'
      }}
      toastClassName="tp-toast"
    />,
    host
  );
}

// ToastContainer mounts under #tp-portal-root with global --toastify-z-index (above modals)
export const ToastProvider = ({ children }) => (
  <>
    {children}
    <TpToastContainer />
  </>
);
