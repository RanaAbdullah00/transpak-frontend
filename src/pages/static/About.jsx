import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const About = () => {
  const { t, isUrdu } = useLanguage();
  return (
    <div className={`tp-auth-shell min-vh-100 tp-static-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="container py-4 tp-auth-page">
      <Card className="p-4 shadow-sm border-0">
        <h4 className="fw-bold mb-3">{t('pages.static.aboutTitle')}</h4>
        <p className="text-muted mb-3">{t('pages.static.aboutBody')}</p>
        <Link to="/contact" className="small">
          {t('pages.static.contactLink')}
        </Link>
      </Card>
      </div>
    </div>
  );
};

export default About;
