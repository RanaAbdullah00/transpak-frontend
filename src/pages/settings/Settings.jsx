import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useTheme } from '../../hooks/useTheme.js';
import { FaSun, FaMoon, FaQuestionCircle, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { useLanguage } from '../../hooks/useLanguage.js';
import LanguageToggle from '../../components/ui/LanguageToggle.jsx';

const Settings = () => {
  const { t, isUrdu } = useLanguage();
  const { logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const rowClass =
    'tp-settings-row d-flex align-items-center justify-content-between gap-3 py-3 px-1 border-bottom border-opacity-25';
  const Chev = isUrdu ? FaChevronLeft : FaChevronRight;

  return (
    <div className={`container py-3 tp-settings-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <h1 className="tp-page-title h5 mb-3">{t('common.settings')}</h1>

      <div className="tp-settings-surface rounded-3 overflow-hidden">
        <Link
          to="/profile"
          className={`${rowClass} text-decoration-none text-body tp-settings-row--action`}
        >
          <span>{t('common.profile')}</span>
          <Chev className="tp-settings-chevron flex-shrink-0" size={12} aria-hidden />
        </Link>

        <Link
          to="/support#faq"
          className={`${rowClass} text-decoration-none text-body tp-settings-row--action`}
        >
          <span className="d-flex align-items-center gap-2">
            <FaQuestionCircle size={14} className="flex-shrink-0 tp-settings-chevron" aria-hidden />
            {t('common.faqHelp')}
          </span>
          <Chev className="tp-settings-chevron flex-shrink-0" size={12} aria-hidden />
        </Link>

        <div className={rowClass}>
          <span className="small fw-medium text-body">{t('auth.language')}</span>
          <LanguageToggle className="rounded-pill" />
        </div>

        <div className={rowClass}>
          <span className="d-flex align-items-center gap-2 small fw-medium text-body">
            {darkMode ? <FaMoon size={14} aria-hidden /> : <FaSun size={14} aria-hidden />}
            {t('common.darkMode')}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-pill px-3 tp-settings-theme-toggle"
            onClick={toggleDarkMode}
            aria-label={darkMode ? t('common.ariaSwitchLight') : t('common.ariaSwitchDark')}
          >
            {darkMode ? t('common.light') : t('common.dark')}
          </button>
        </div>

        <div className="py-3 px-1">
          <Button variant="outline-danger" className="w-100 rounded-pill py-2 tp-settings-logout" onClick={handleLogout}>
            {t('common.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
