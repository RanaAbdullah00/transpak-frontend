import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

const CarrierVerification = ({ embedded = false }) => {
  const { t, isUrdu } = useLanguage();
  const body = (
    <>
      {!embedded ? (
        <>
          <h5 className="mb-3">{t('pages.carrierVerificationPage.title')}</h5>
          <p className="text-muted small mb-4">{t('pages.carrierVerificationPage.intro')}</p>
        </>
      ) : null}
      <Card className="p-3 p-md-4 mb-3">
        <h6 className="small fw-semibold text-uppercase text-muted mb-2">
          {t('pages.carrierVerificationPage.stepProfileTitle')}
        </h6>
        <p className="small mb-4">{t('pages.carrierVerificationPage.stepProfileBody')}</p>
        <h6 className="small fw-semibold text-uppercase text-muted mb-2">
          {t('pages.carrierVerificationPage.stepFleetTitle')}
        </h6>
        <p className="small mb-4">{t('pages.carrierVerificationPage.stepFleetBody')}</p>
        <div className="d-flex flex-column flex-sm-row gap-2">
          <Link to="/profile" className="btn btn-primary rounded-pill fw-semibold">
            {t('pages.carrierVerificationPage.openProfile')}
          </Link>
          <Link to="/carrier/truck-details" className="btn btn-outline-primary rounded-pill fw-semibold">
            {t('pages.carrierVerificationPage.openTrucks')}
          </Link>
        </div>
      </Card>
      <Card className="p-3 border-0 bg-body-secondary">
        <div className="small fw-semibold mb-1">{t('pages.carrierVerificationPage.noteTitle')}</div>
        <p className="small text-muted mb-0">{t('pages.carrierVerificationPage.noteBody')}</p>
      </Card>
    </>
  );

  if (embedded) return body;

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="row justify-content-center">
        <div className="col-lg-8">{body}</div>
      </div>
    </div>
  );
};

export default CarrierVerification;
