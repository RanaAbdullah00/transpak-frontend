import React, { useMemo, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import DemoVideoWatchButton from '../../components/demo/DemoVideoWatchButton.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

// FAQ / Help — includes full official walkthrough access (demo video not on dashboards).
const Support = () => {
  const { t } = useLanguage();
  const faqs = useMemo(
    () => [
      { q: t('pages.supportPage.faq1Q'), a: t('pages.supportPage.faq1A') },
      { q: t('pages.supportPage.faq2Q'), a: t('pages.supportPage.faq2A') },
      { q: t('pages.supportPage.faq3Q'), a: t('pages.supportPage.faq3A') },
      { q: t('pages.supportPage.faq4Q'), a: t('pages.supportPage.faq4A') }
    ],
    [t]
  );
  const [open, setOpen] = useState(0);

  return (
    <div className="container py-3 tp-support-page">
      <h5 className="mb-3 text-body">{t('pages.supportPage.title')}</h5>
      <Card className="p-3 tp-support-card">
        <p className="small mb-2 tp-support-body">
          {t('pages.supportPage.emailLabel')}:{' '}
          <a className="tp-support-link" href="mailto:support@transpak.pk">
            support@transpak.pk
          </a>
        </p>
        <p className="small mb-0 tp-support-body">
          {t('pages.supportPage.hotlineLabel')}: +92-300-0000000
        </p>
      </Card>

      <div id="help-demo" className="mt-3">
        <h6 className="mb-2 text-body">{t('pages.support.demoSectionTitle')}</h6>
        <Card className="p-3 tp-support-card">
          <p className="small mb-3 tp-support-muted">{t('pages.support.demoSectionBody')}</p>
          <DemoVideoWatchButton variant="block" />
        </Card>
      </div>

      <div id="faq" className="mt-3 tp-support-faq">
        <h6 className="mb-2 text-body">{t('pages.supportPage.faqTitle')}</h6>
        <Card className="p-2 tp-support-card">
          {faqs.map((f, idx) => (
            <button
              key={f.q}
              type="button"
              className="btn w-100 text-start tp-support-faq__toggle rounded-3"
              onClick={() => setOpen((p) => (p === idx ? -1 : idx))}
            >
              <div className="d-flex justify-content-between align-items-center gap-2">
                <span className="fw-semibold tp-support-faq__q">{f.q}</span>
                <span className="tp-support-faq__icon" aria-hidden>
                  {open === idx ? '−' : '+'}
                </span>
              </div>
              {open === idx ? <div className="small mt-2 tp-support-faq__a">{f.a}</div> : null}
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
};

export default Support;
