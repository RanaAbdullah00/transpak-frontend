import React, { useCallback, useState } from 'react';
import Button from '../ui/Button.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import {
  DEMO_GUIDE_STEPS,
  getDemoGuideStep,
  isDemoModeEnabled,
  isDemoMockApiEnabled,
  setDemoGuideStep,
  setDemoMockApiEnabled
} from '../../utils/demoMode.js';

const DemoModeBanner = () => {
  const { t } = useLanguage();
  const [mockOn, setMockOn] = useState(() => isDemoMockApiEnabled());
  const [guideStep, setGuideStep] = useState(() => getDemoGuideStep());

  const enabled = isDemoModeEnabled();
  const advanceGuide = useCallback(() => {
    const next = (guideStep + 1) % DEMO_GUIDE_STEPS.length;
    setGuideStep(next);
    setDemoGuideStep(next);
  }, [guideStep]);

  const toggleMock = () => {
    const next = !mockOn;
    setMockOn(next);
    setDemoMockApiEnabled(next);
    window.location.reload();
  };

  if (!enabled) return null;

  const currentGuide = DEMO_GUIDE_STEPS[guideStep];

  return (
    <div className="tp-demo-banner" role="region" aria-label={t('demo.bannerTitle')}>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
        <div>
          <strong className="small d-block">{t('demo.bannerTitle')}</strong>
          <span className="small text-muted">{t('demo.bannerHint')}</span>
          {currentGuide ? (
            <p className="small mb-0 mt-1 text-primary fw-semibold">
              {t('demo.guideLabel')}: {t(currentGuide.labelKey)}
            </p>
          ) : null}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-primary" size="sm" type="button" onClick={advanceGuide}>
            {t('demo.nextStep')}
          </Button>
          <Button variant={mockOn ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={toggleMock}>
            {mockOn ? t('demo.mockOn') : t('demo.mockOff')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DemoModeBanner;
