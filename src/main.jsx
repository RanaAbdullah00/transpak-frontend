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
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import { initTranspakBuildInfo } from './utils/buildInfo.js';
import { verifyProductionDeploy } from './utils/verifyDeploy.js';

initTranspakBuildInfo();
verifyProductionDeploy();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
              </ToastProvider>
            </AppProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
