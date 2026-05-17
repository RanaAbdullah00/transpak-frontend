import React from 'react';
import { createPortal } from 'react-dom';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useTheme } from '../../hooks/useTheme.js';
import { getPortalContainer } from '../../utils/portalRoot.js';

const baseOpts = {
  position: 'top-right',
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored'
};

export const notifySuccess = (message, opts = {}) =>
  toast.success(message, { ...baseOpts, autoClose: opts.autoClose ?? 4000, className: 'tp-toast tp-toast--success' });

export const notifyError = (message, opts = {}) =>
  toast.error(message, { ...baseOpts, autoClose: opts.autoClose ?? 5500, className: 'tp-toast tp-toast--error' });

export const notifyInfo = (message, opts = {}) =>
  toast.info(message, { ...baseOpts, autoClose: opts.autoClose ?? 4000, className: 'tp-toast tp-toast--info' });

export const notifyWarning = (message, opts = {}) =>
  toast.warning(message, { ...baseOpts, autoClose: opts.autoClose ?? 4500, className: 'tp-toast tp-toast--warning' });

/** Domain events — use translation keys or plain messages */
export const notifyBidAccepted = (msg) => notifySuccess(msg);
export const notifyBidRejected = (msg) => notifyInfo(msg);
export const notifyCounterOffer = (msg) => notifyInfo(msg);
export const notifyContractStarted = (msg) => notifySuccess(msg, { autoClose: 5000 });
export const notifyLoadPosted = (msg) => notifySuccess(msg);
export const notifyProfileUpdated = (msg) => notifySuccess(msg);
export const notifyTruckUpdated = (msg) => notifySuccess(msg);

export { toast };

function TpToastContainer() {
  const { isUrdu } = useLanguage();
  const { darkMode } = useTheme();
  const host = getPortalContainer();
  if (!host) return null;
  return createPortal(
    <ToastContainer
      containerId="tp-toastify"
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={isUrdu}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={darkMode ? 'dark' : 'colored'}
      transition={Slide}
      className="tp-toast-host"
      toastClassName="tp-toast"
      progressClassName="tp-toast-progress"
    />,
    host
  );
}

export const ToastProvider = ({ children }) => (
  <>
    {children}
    <TpToastContainer />
  </>
);
