import React from 'react';
import { useLanguage } from '../../hooks/useLanguage.js';

// Small language toggle button used on auth screens.
const LanguageToggle = ({ className = '' }) => {
  const { lang, toggleLanguage, t } = useLanguage();

  return (
    <button
      type="button"
      className={`btn btn-outline-secondary btn-sm rounded-pill tp-lang-toggle ${className}`}
      onClick={toggleLanguage}
      aria-label={t('auth.language')}
    >
      {lang === 'en' ? t('auth.urdu') : t('auth.english')}
    </button>
  );
};

export default LanguageToggle;

