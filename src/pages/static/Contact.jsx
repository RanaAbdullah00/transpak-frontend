import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifySuccess } from '../../components/ui/ToastProvider.jsx';

const Contact = () => {
  const { t, isUrdu } = useLanguage();
  const [message, setMessage] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    notifySuccess(t('pages.static.contactThanks'));
    setMessage('');
  };

  return (
    <div className={`tp-auth-shell min-vh-100 tp-static-page ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="container py-4 tp-auth-page">
      <Card className="p-4 shadow-sm border-0">
        <h4 className="fw-bold mb-2">{t('pages.static.contactTitle')}</h4>
        <p className="text-muted small mb-3">{t('pages.static.contactIntro')}</p>
        <form onSubmit={submit}>
          <label className="form-label small">{t('pages.static.contactMessage')}</label>
          <textarea
            className="form-control form-control-sm mb-2"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('pages.static.contactPlaceholder')}
            maxLength={2000}
          />
          <Button type="submit" variant="primary" size="sm">
            {t('pages.static.contactSubmit')}
          </Button>
        </form>
      </Card>
      </div>
    </div>
  );
};

export default Contact;
