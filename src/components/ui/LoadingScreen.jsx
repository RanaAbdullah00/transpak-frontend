import React from 'react';
import BrandLogo from '../layout/BrandLogo.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from './TranslatedText.jsx';

// Full-screen loading UI to prevent blank screens during async gates.
const LoadingScreen = ({ message }) => {
  const lang = useLanguage();
  const t = lang?.t;
  const msg =
    message ?? (typeof t === 'function' ? t('common.preparingWorkspace') : 'Preparing your workspace…');
  return (
    <div className="tp-loading-screen">
      <div className="tp-loading-card">
        <BrandLogo className="tp-loading-logo" />
        <div className="small text-muted mt-2">
          <TranslatedText text={msg} as="span" enabled={Boolean(message)} />
          {!message && msg}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
