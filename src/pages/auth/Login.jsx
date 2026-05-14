import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../../components/auth/LoginForm.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import AuthHeaderActions from '../../components/auth/AuthHeaderActions.jsx';
import { useAuthViewportLock } from '../../hooks/useAuthViewportLock.js';

// Viewport-locked enterprise auth: brand only in header; centered glass card.
const Login = () => {
  const { t, isUrdu } = useLanguage();
  useAuthViewportLock();

  return (
    <div className={`tp-auth-v2 tp-auth-v2--locked position-relative ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="tp-auth-v2__bg" aria-hidden="true">
        <div className="tp-auth-v2__veil" />
        <div className="tp-auth-v2__accent-slab" />
        <div className="tp-auth-v2__grid" />
        <div className="tp-auth-v2__route-line tp-auth-v2__route-line--1" />
        <div className="tp-auth-v2__route-line tp-auth-v2__route-line--2" />
      </div>
      <header className="tp-auth-v2__top tp-auth-v2__top--bar d-flex align-items-center justify-content-between w-100 px-3 z-3">
        <BrandLogo
          variant="auth"
          title="TransPak"
          className="tp-auth-v2__header-brand flex-shrink-0"
          onClick={() => window.dispatchEvent(new CustomEvent('tp_login_reset_role'))}
        />
        <AuthHeaderActions />
      </header>
      <div className="tp-auth-v2__body">
        <div className="tp-auth-v2__glass rounded-4 shadow-lg border">
          <div className="tp-auth-v2__glass-content tp-auth-v2__glass-content--login">
            <h1 className="h5 fw-bold mb-3 text-body tp-auth-v2__title">{t('auth.signIn')}</h1>
            <LoginForm />
            <p className="small text-center mt-auto pt-2 mb-0 text-muted tp-auth-v2__footer-line">
              {t('auth.newToTranspak')} <Link to="/signup">{t('auth.createAccount')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
