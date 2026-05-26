import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/layout/BrandLogo.jsx';
import LanguageToggle from '../../components/ui/LanguageToggle.jsx';
import DemoVideoWatchButton from '../../components/demo/DemoVideoWatchButton.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { getApiUrl } from '../../config/apiConfig.js';

const Section = ({ id, className = '', children }) => (
  <section id={id} className={`tp-landing-section ${className}`.trim()}>
    {children}
  </section>
);

const Landing = () => {
  const { t, isUrdu } = useLanguage();
  const [freightStats, setFreightStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/public/stats'), { credentials: 'omit' });
        const json = await res.json();
        const data = json?.data ?? json;
        if (!cancelled && data && typeof data === 'object') setFreightStats(data);
      } catch {
        /* keep i18n fallbacks */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpiValues = [
    freightStats?.openLoads ?? t('pages.landing.previewKpi1Val'),
    freightStats?.activeShipments ?? t('pages.landing.previewKpi2Val'),
    freightStats?.bidsToday ?? t('pages.landing.previewKpi3Val')
  ];
  const liveMetrics = [
    { label: t('pages.landing.previewKpi1Label'), value: freightStats?.openLoads ?? '—' },
    { label: t('pages.landing.previewKpi2Label'), value: freightStats?.activeShipments ?? '—' },
    { label: t('pages.landing.previewKpi3Label'), value: freightStats?.bidsToday ?? '—' },
    { label: t('pages.landing.platformMetricCarriers'), value: freightStats?.carriersActive ?? '—' }
  ];
  const trustItems = [
    t('pages.landing.trustStrip1'),
    t('pages.landing.trustStrip2'),
    t('pages.landing.trustStrip3')
  ];

  return (
    <div className={`tp-landing min-vh-100 d-flex flex-column ${isUrdu ? 'tp-rtl' : ''}`}>
      <header className="tp-landing-nav sticky-top border-bottom">
        <div className="container py-2 d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <Link to="/" className="text-decoration-none text-body d-flex align-items-center gap-2">
            <BrandLogo variant="mark" title={t('common.appName')} className="tp-landing-nav__brand" />
            <span className="fw-bold small text-uppercase letter-spacing-1 d-none d-sm-inline">{t('common.appName')}</span>
          </Link>
          <nav className="d-flex align-items-center gap-1 gap-md-2 flex-wrap small">
            <a href="#features" className="tp-landing-nav__link d-none d-md-inline">
              {t('pages.landing.navFeatures')}
            </a>
            <a href="#how" className="tp-landing-nav__link d-none d-md-inline">
              {t('pages.landing.navHowItWorks')}
            </a>
            <a href="#roles" className="tp-landing-nav__link d-none d-md-inline">
              {t('pages.landing.navRoles')}
            </a>
            <a href="#faq" className="tp-landing-nav__link d-none d-lg-inline">
              {t('pages.landing.navFaq')}
            </a>
            <LanguageToggle className="btn btn-sm btn-outline-secondary rounded-pill" />
            <DemoVideoWatchButton variant="compact" className="btn-sm" />
            <Link to="/login" className="btn btn-sm btn-outline-primary rounded-pill">
              {t('pages.landing.navSignIn')}
            </Link>
            <Link to="/signup" className="btn btn-sm btn-primary rounded-pill fw-semibold">
              {t('pages.landing.navGetStarted')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow-1 tp-landing-main min-w-0">
        <Section className="tp-landing-hero tp-landing-hero--gradient">
          <div className="container position-relative py-4 py-lg-5 tp-landing-hero__content">
            <div className="row align-items-center g-4">
              <div className="col-lg-6">
                <p className="tp-landing-kicker small fw-semibold text-uppercase text-primary mb-2">
                  {t('pages.landing.kicker')}
                </p>
                <h1 className="display-6 fw-bold mb-3 tp-landing-hero__title">{t('pages.landing.heroTitle')}</h1>
                <p className="lead mb-4 tp-landing-hero__sub">{t('pages.landing.heroSubtitle')}</p>
                <div className="d-flex flex-wrap gap-2 tp-landing-hero__ctas">
                  <Link to="/signup" className="btn btn-primary btn-lg rounded-pill px-4 fw-semibold tp-landing-fade-in">
                    {t('pages.landing.heroCtaPrimary')}
                  </Link>
                  <Link to="/login" className="btn btn-outline-secondary btn-lg rounded-pill px-4">
                    {t('pages.landing.heroCtaSecondary')}
                  </Link>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="tp-landing-workspace-preview tp-landing-hero-card rounded-4 border bg-body">
                  <div className="tp-landing-dash">
                    <div className="tp-landing-route-line tp-landing-dash__route-line mb-3" aria-hidden="true" />
                    <div className="tp-landing-dash__header d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                      <p className="tp-landing-preview-head fw-semibold mb-0">{t('pages.landing.previewTitle')}</p>
                      <span className="tp-landing-dash__live small fw-semibold">
                        <span className="tp-landing-dash__pulse" aria-hidden="true" />
                        {t('pages.landing.previewLive')}
                      </span>
                    </div>
                    <div className="row row-cols-3 g-2 tp-landing-dash__kpis">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="col">
                          <div className="tp-landing-dash__kpi tp-landing-surface-inset rounded-3 text-center px-1 py-2 h-100">
                            <div className="tp-landing-dash__kpi-val fw-bold text-body lh-1">{kpiValues[n - 1]}</div>
                            <div className="tp-landing-dash__kpi-label small text-muted text-truncate mt-1">{t(`pages.landing.previewKpi${n}Label`)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="row g-2 align-items-stretch mt-2">
                      <div className="col-md-7">
                        <div className="tp-landing-dash__ship-card tp-landing-surface-inset rounded-3 h-100 d-flex flex-column p-3">
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                            <div className="min-w-0">
                              <p className="tp-landing-dash__eyebrow small text-muted mb-0">{t('pages.landing.previewShipmentRef')}</p>
                              <p className="fw-semibold text-body mb-0 mt-1 text-truncate">{t('pages.landing.previewShipmentRoute')}</p>
                            </div>
                            <span className="tp-landing-dash__status flex-shrink-0">{t('pages.landing.previewShipmentStatus')}</span>
                          </div>
                          <div
                            className="progress tp-landing-dash__progress rounded-pill mt-auto"
                            role="progressbar"
                            aria-valuenow={62}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={t('pages.landing.previewShipmentStatus')}
                          >
                            <div className="progress-bar bg-primary rounded-pill" style={{ width: '62%' }} />
                          </div>
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="tp-landing-dash__map-card tp-landing-surface-inset rounded-3 h-100 d-flex flex-column p-3">
                          <p className="tp-landing-dash__eyebrow small text-muted mb-2">{t('pages.landing.previewMapTitle')}</p>
                          <div
                            className="tp-landing-dash__map flex-grow-1"
                            role="img"
                            aria-label={t('pages.landing.previewMapTitle')}
                          >
                            <span className="tp-landing-dash__map-pin" aria-hidden="true" />
                          </div>
                          <p className="small text-muted mb-0 mt-2">{t('pages.landing.previewMapSub')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="tp-landing-dash__activity tp-landing-surface-inset rounded-3 mt-2 p-3">
                      <p className="small fw-semibold text-body mb-2">{t('pages.landing.previewActivityTitle')}</p>
                      <ul className="tp-landing-dash__feed list-unstyled mb-0">
                        {[1, 2, 3].map((n) => (
                          <li key={n} className="tp-landing-dash__feed-item small text-muted">
                            <span className="tp-landing-dash__feed-dot" aria-hidden="true" />
                            {t(`pages.landing.previewAct${n}`)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section className="tp-landing-trust border-top border-bottom bg-body-secondary">
          <div className="container py-3">
            <ul className="tp-landing-trust__list list-unstyled mb-0 d-flex flex-column flex-md-row flex-wrap gap-2 gap-md-4 justify-content-center small">
              {trustItems.map((item) => (
                <li key={item} className="tp-landing-trust__item d-flex align-items-center gap-2">
                  <span className="tp-landing-trust__dot" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section className="tp-landing-section--rhythm">
          <div className="container tp-landing-section__inner">
            <h2 className="h4 fw-bold text-body mb-1">{t('pages.landing.platformLiveTitle')}</h2>
            <p className="text-muted small mb-3">{t('pages.landing.platformLiveSub')}</p>
            <div className="row g-2 g-md-3">
              {liveMetrics.map((m) => (
                <div key={m.label} className="col-6 col-lg-3">
                  <div className="tp-landing-live-metric rounded-3 border bg-body p-3 h-100 text-center">
                    <div className="h4 fw-bold text-primary mb-0">{m.value}</div>
                    <div className="small text-muted mt-1">{m.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section className="tp-landing-section--rhythm">
          <div className="container tp-landing-section__inner">
            <h2 className="h4 fw-bold text-body mb-3">{t('pages.landing.introTitle')}</h2>
            <p className="text-muted col-lg-10 col-xl-8 mb-0">{t('pages.landing.introBody')}</p>
          </div>
        </Section>

        <Section id="features" className="bg-body-secondary border-top border-bottom tp-landing-section--rhythm">
          <div className="container tp-landing-section__inner">
            <h2 className="h4 fw-bold text-body mb-2">{t('pages.landing.featuresTitle')}</h2>
            <p className="text-muted small mb-4 col-lg-10">{t('pages.landing.featuresLead')}</p>
            <div className="row g-4 tp-landing-features-row">
              {[
                ['featLoadsTitle', 'featLoadsBody'],
                ['featBidsTitle', 'featBidsBody'],
                ['featTrackTitle', 'featTrackBody'],
                ['featCommsTitle', 'featCommsBody'],
                ['featTrustTitle', 'featTrustBody']
              ].map(([titleKey, bodyKey], idx) => (
                <div key={titleKey} className="col-md-6 col-xl-4">
                  <div className="tp-landing-feature tp-landing-surface-card h-100 rounded-4 border bg-body p-4 border-start border-3 border-primary">
                    <div className="d-flex gap-3">
                      <span className="tp-landing-feature__badge flex-shrink-0" aria-hidden="true">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h3 className="h6 fw-semibold text-body mb-2">{t(`pages.landing.${titleKey}`)}</h3>
                        <p className="small text-muted mb-0">{t(`pages.landing.${bodyKey}`)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="how" className="tp-landing-section--rhythm tp-landing-how-section">
          <div className="container tp-landing-section__inner pb-0">
            <h2 className="h4 fw-bold text-body mb-3">{t('pages.landing.howTitle')}</h2>
          </div>
          <div className="tp-landing-how-fullbleed">
            <div className="tp-landing-how-visual">
              <div className="tp-landing-how-visual__frame">
                <img
                  src={`${import.meta.env.BASE_URL}landing.png`}
                  alt={t('pages.landing.heroImageAlt')}
                  className="tp-landing-how-visual__img"
                  loading="lazy"
                  decoding="async"
                />
                <div className="tp-landing-how-visual__scrim" aria-hidden="true" />
                <ol className="tp-landing-how-visual__steps" aria-label={t('pages.landing.howWorkflowAria')}>
                  {[1, 2, 3, 4].map((n) => (
                    <li key={n} className="tp-landing-how-visual__step">
                      <span className="tp-landing-how-visual__step-n" aria-hidden="true">
                        {n}
                      </span>
                      <span className="tp-landing-how-visual__step-t">{t(`pages.landing.howWorkflowStep${n}`)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
          <div className="container tp-landing-section__inner pt-3">
            <div className="tp-landing-timeline mt-2 pt-2 border-top border-opacity-25">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="tp-landing-timeline__step">
                  <div className="tp-landing-timeline__dot">{n}</div>
                  <div className="min-w-0">
                    <h3 className="h6 fw-semibold text-body mb-1">{t(`pages.landing.how${n}Title`)}</h3>
                    <p className="small text-muted mb-0">{t(`pages.landing.how${n}Body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section id="roles" className="bg-body-secondary border-top border-bottom tp-landing-section--rhythm">
          <div className="container tp-landing-section__inner">
            <h2 className="h4 fw-bold text-body mb-4">{t('pages.landing.rolesTitle')}</h2>
            <div className="row g-4">
              {['Shipper', 'Carrier', 'Fleet'].map((role) => (
                <div key={role} className="col-md-4">
                  <div className="tp-landing-role-card tp-landing-surface-card rounded-4 border bg-body p-4 h-100 border-start border-3 border-primary">
                    <h3 className="h6 fw-semibold text-body mb-2">{t(`pages.landing.role${role}Title`)}</h3>
                    <p className="small text-muted mb-0">{t(`pages.landing.role${role}Body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section className="tp-landing-section--rhythm">
          <div className="container tp-landing-section__inner">
            <h2 className="h4 fw-bold text-body mb-4">{t('pages.landing.statsTitle')}</h2>
            <div className="row g-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="col-md-4">
                  <div className="tp-landing-stat-card tp-landing-surface-card rounded-3 border p-4 h-100 bg-body">
                    <h3 className="h6 fw-semibold text-body mb-2">{t(`pages.landing.stat${n}Title`)}</h3>
                    <p className="small text-muted mb-0">{t(`pages.landing.stat${n}Body`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section className="tp-landing-cta-band tp-landing-section--rhythm">
          <div className="container">
            <div className="tp-landing-cta-band__inner rounded-4 p-4 p-md-5 text-center text-md-start">
              <div className="row align-items-center g-3">
                <div className="col-md-8">
                  <h2 className="h5 fw-bold text-white mb-2">{t('pages.landing.ctaBandTitle')}</h2>
                  <p className="small text-white text-opacity-90 mb-0">{t('pages.landing.ctaBandBody')}</p>
                </div>
                <div className="col-md-4 d-flex flex-wrap gap-2 justify-content-center justify-content-md-end">
                  <Link to="/signup" className="btn btn-light btn-sm rounded-pill px-4 fw-semibold">
                    {t('pages.landing.ctaBandPrimary')}
                  </Link>
                  <Link to="/login" className="btn btn-outline-light btn-sm rounded-pill px-4">
                    {t('pages.landing.ctaBandSecondary')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section id="faq" className="border-top tp-landing-section--rhythm">
          <div className="container tp-landing-section__inner">
            <h2 className="h4 fw-bold text-body mb-4">{t('pages.landing.faqTitle')}</h2>
            <div className="d-flex flex-column gap-2">
              {[1, 2, 3, 4].map((n) => (
                <details key={n} className="tp-landing-details tp-landing-details--elevated border rounded-3 bg-body px-3 py-2">
                  <summary className="small fw-semibold py-1 cursor-pointer">{t(`pages.landing.faq${n}Q`)}</summary>
                  <p className="small text-muted mt-2 mb-0 ps-1">{t(`pages.landing.faq${n}A`)}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>
      </main>

      <footer className="tp-landing-footer border-top mt-auto">
        <div className="container py-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
            <div>
              <div className="fw-bold text-uppercase small mb-1">{t('common.appName')}</div>
              <p className="small text-muted mb-0">{t('pages.landing.footerTagline')}</p>
            </div>
            <div className="d-flex gap-3 small">
              <Link to="/about" className="text-decoration-none text-muted">
                {t('pages.static.aboutTitle')}
              </Link>
              <Link to="/contact" className="text-decoration-none text-muted">
                {t('pages.landing.footerContact')}
              </Link>
              <Link to="/login" className="text-decoration-none text-muted">
                {t('pages.landing.navSignIn')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
