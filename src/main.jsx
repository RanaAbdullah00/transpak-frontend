import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import './styles/theme-tokens.css';
import './styles/mobile.css';
import './styles/theme-utilities.css';
import './styles/dark-mode-polish.css';

import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/ui/ToastProvider.jsx';
import NotificationToastHost from './components/notifications/NotificationToast.jsx';
import { initTranspakBuildInfo } from './utils/buildInfo.js';
import { verifyProductionDeploy } from './utils/verifyDeploy.js';
import { initContractSyncGuarantee } from './utils/contractSyncGuarantee.js';
import { initPerformanceTelemetryExport } from './utils/performanceTelemetryExport.js';
import { handleShipmentActivationSync } from './utils/contractActivation.js';
import { resetActiveShipmentBootstrap } from './utils/activeShipmentBootstrap.js';

function initSessionHydration() {
  if (typeof window === 'undefined') return;
  window.addEventListener('tp:session-established', () => {
    resetActiveShipmentBootstrap();
    void handleShipmentActivationSync(null, { force: true });
  });
  window.addEventListener('tp:role-switched', () => {
    resetActiveShipmentBootstrap();
  });
  window.addEventListener('tp:session-cleared', () => {
    resetActiveShipmentBootstrap();
  });
}

initTranspakBuildInfo();
verifyProductionDeploy();
initContractSyncGuarantee();
initPerformanceTelemetryExport();
initSessionHydration();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppProvider>
              <ToastProvider>
                <NotificationToastHost />
                <App />
              </ToastProvider>
            </AppProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
