import React from 'react';
import Card from '../ui/Card.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatDistanceKm } from '../../utils/formatDistance.js';

const RouteInfo = ({ distance, duration, estimatedHours, checkpoints }) => {
  const { t } = useLanguage();
  const dist = formatDistanceKm(distance, t);
  const hours = estimatedHours ?? duration;

  return (
    <Card>
      <h6 className="mb-2">Route overview</h6>
      <div className="d-flex justify-content-between small mb-2 gap-2 flex-wrap">
        <span>Distance: {dist.display}</span>
        <span>
          Estimated Time:{' '}
          {hours != null && hours !== '' ? `${hours} hrs` : t('common.emDash')}
        </span>
      </div>
      <ol className="small ps-3 mb-0">
        {(Array.isArray(checkpoints) ? checkpoints : []).map((cp) => (
          <li key={cp}>{cp}</li>
        ))}
      </ol>
    </Card>
  );
};

export default RouteInfo;
