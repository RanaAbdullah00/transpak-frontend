import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';

const ApproveCarrier = () => {
  const { t } = useLanguage();
  const [ack, setAck] = useState(false);

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.bids.approveCarrier')}</h5>
      <Card>
        <div className="text-muted small">{t('pages.bids.approveCarrierLead')}</div>
        <div className="mt-3 d-flex gap-2 flex-wrap">
          <Link className="btn btn-primary btn-sm rounded-lg" to="/bids">
            {t('pages.bids.approveCarrierReviewBids')}
          </Link>
          <Link className="btn btn-outline-secondary btn-sm rounded-lg" to="/loads/manage">
            {t('pages.bids.approveCarrierManageLoads')}
          </Link>
          <Button
            variant={ack ? 'success' : 'outline-success'}
            className="btn-sm rounded-lg"
            onClick={() => setAck(true)}
          >
            {ack ? t('pages.bids.approveCarrierGotIt') : t('pages.bids.approveCarrierOk')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ApproveCarrier;
