import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';
import Loader from '../../components/ui/Loader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import BrandLogo from '../../components/layout/BrandLogo.jsx';

const Splash = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 2300);
      return () => clearTimeout(timer);
    }
  }, [loading, user, navigate]);

  return (
    <div className="splash-container d-flex flex-column justify-content-center align-items-center vh-100 bg-gradient text-white">
      <BrandLogo className="tp-brand-logo-intro mb-4 mx-auto" />
      <p className="mb-4 text-center px-4 lead">
        {t('common.appName')} - پاکستان بھر شپर्स اور کیریئرز کو جوڑنے والا ڈیجیٹل فریٹ ایکسچینج
      </p>
      <Loader light />
    </div>
  );
};

export default Splash;
