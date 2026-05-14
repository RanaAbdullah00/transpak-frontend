import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FleetList from '../../components/fleet/FleetList.jsx';
import Loader from '../../components/ui/Loader.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';

const FleetMonitoring = () => {
  const { t, isUrdu } = useLanguage();
  const { request, loading } = useApi();
  const [trucks, setTrucks] = useState([]);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await request({ method: 'GET', url: '/trucks/mine' });
      setTrucks(Array.isArray(data) ? data : []);
    } catch {
      setLoadError(true);
      setTrucks([]);
    }
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className={`container py-3 tp-page-fleet ${isUrdu ? 'tp-rtl' : ''}`}>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-md-between gap-2 mb-3">
        <div>
          <h5 className="mb-1">{t('pages.fleet.monitoringTitle')}</h5>
          <p className="small text-muted mb-0">{t('pages.fleet.monitoringIntro')}</p>
        </div>
        <Link
          to="/carrier/truck-details"
          className="btn btn-primary btn-sm rounded-pill fw-semibold align-self-stretch align-self-md-auto"
        >
          {t('pages.fleet.manageFleetCta')}
        </Link>
      </div>
      {loadError ? (
        <p className="small text-danger mb-2" role="status">
          {t('pages.fleet.loadFailed')}
        </p>
      ) : null}
      {loading && trucks.length === 0 && !loadError ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <FleetList trucks={trucks} />
      )}
    </div>
  );
};

export default FleetMonitoring;
