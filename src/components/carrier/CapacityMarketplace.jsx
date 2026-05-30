import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { emitRealtimeRefresh } from '../../utils/spaceFlow.js';
import { getVehicleTypeLabel } from '../../data/vehicleTypes.js';
import CitySelect from '../ui/CitySearchSelect.jsx';
import SpaceSentRequestsPanel from './SpaceSentRequestsPanel.jsx';
import CarrierSpaceCard from './CarrierSpaceCard.jsx';
import { kgToTons, tonsToKg } from '../../utils/weightUnits.js';

const DEFAULT_FILTERS = {
  origin: '',
  destination: '',
  minCapacityTons: '',
  maxCapacityTons: '',
  availableFrom: '',
  sort: 'newest'
};

const CapacityMarketplace = () => {
  const { t, lang } = useLanguage();
  const { request, loading } = useApi();
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [listings, setListings] = useState([]);
  const [listError, setListError] = useState(null);
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestTons, setRequestTons] = useState('');
  const debounced = useDebouncedValue(filters, 400);

  const refresh = useCallback(async () => {
    setListError(null);
    try {
      const minTons = Number(debounced.minCapacityTons);
      const data = await request({
        method: 'GET',
        url: '/carrier-space',
        params: {
          origin: debounced.origin || undefined,
          destination: debounced.destination || undefined,
          minCapacityKg:
            Number.isFinite(minTons) && minTons > 0 ? tonsToKg(minTons) : undefined,
          availableFrom: debounced.availableFrom || undefined
        },
        skipGlobalErrorToast: true
      });
      let rows = Array.isArray(data) ? data : [];
      const maxTons = Number(debounced.maxCapacityTons);
      if (Number.isFinite(maxTons) && maxTons > 0) {
        const maxKg = tonsToKg(maxTons);
        rows = rows.filter((r) => Number(r.remainingSpaceKg) <= maxKg);
      }
      if (debounced.sort === 'capacity_desc') {
        rows = [...rows].sort((a, b) => Number(b.remainingSpaceKg) - Number(a.remainingSpaceKg));
      } else if (debounced.sort === 'rate_asc') {
        rows = [...rows].sort(
          (a, b) => Number(a.ratePerKg ?? 999999) - Number(b.ratePerKg ?? 999999)
        );
      }
      setListings(rows);
    } catch (err) {
      setListings([]);
      setListError(formatUserError(err, t, { fallback: t('loadsHub.capacityListFailed') }));
    }
  }, [request, debounced, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeFilterBadges = useMemo(() => {
    const badges = [];
    if (filters.origin) badges.push({ key: 'origin', label: `${t('loadsHub.filterOrigin')}: ${filters.origin}` });
    if (filters.destination) badges.push({ key: 'destination', label: `${t('loadsHub.filterDestination')}: ${filters.destination}` });
    if (filters.vehicleType) {
      badges.push({
        key: 'vehicleType',
        label: getVehicleTypeLabel(filters.vehicleType, lang === 'ur' ? 'ur' : 'en')
      });
    }
    if (filters.minCapacityTons) {
      badges.push({ key: 'minCapacityTons', label: `≥ ${filters.minCapacityTons} t` });
    }
    if (filters.maxCapacityTons) {
      badges.push({ key: 'maxCapacityTons', label: `≤ ${filters.maxCapacityTons} t` });
    }
    if (filters.availableFrom) badges.push({ key: 'availableFrom', label: filters.availableFrom });
    return badges;
  }, [filters, t, lang]);

  const empty = useMemo(() => !loading && !listError && listings.length === 0, [loading, listError, listings.length]);

  const setField = (name, value) => setFilters((prev) => ({ ...prev, [name]: value }));

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const submitRequest = async () => {
    if (!requestTarget?.id) return;
    try {
      await request({
        method: 'POST',
        url: `/carrier-space/${requestTarget.id}/request`,
        data: { requestedKg: tonsToKg(Number(requestTons)), message: '' }
      });
      notifySuccess(t('loadsHub.requestSent'));
      setRequestTarget(null);
      setRequestTons('');
      refresh();
      emitRealtimeRefresh('space');
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('loadsHub.requestFailed') }));
    }
  };

  return (
    <div>
      <SpaceSentRequestsPanel />
      <div className="tp-filter-card mb-2">
        <div className="row g-2">
          <div className="col-6 col-md-3">
            <CitySelect
              name="origin"
              placeholder={t('loadsHub.filterOrigin')}
              value={filters.origin}
              onChange={(e) => setField('origin', e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <CitySelect
              name="destination"
              placeholder={t('loadsHub.filterDestination')}
              value={filters.destination}
              onChange={(e) => setField('destination', e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <input
              type="date"
              className="form-control form-control-sm rounded-3"
              aria-label={t('loadsHub.availableFrom')}
              value={filters.availableFrom}
              onChange={(e) => setField('availableFrom', e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <input
              type="number"
              min="0"
              className="form-control form-control-sm rounded-3"
              placeholder={t('loadsHub.minCapacityKg')}
              value={filters.minCapacityTons}
              onChange={(e) => setField('minCapacityTons', e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <input
              type="number"
              min="0"
              step="0.1"
              className="form-control form-control-sm rounded-3"
              placeholder={t('loadsHub.maxCapacityKg')}
              value={filters.maxCapacityTons}
              onChange={(e) => setField('maxCapacityTons', e.target.value)}
            />
          </div>
          <div className="col-6 col-md-3">
            <select
              className="form-select form-select-sm rounded-3"
              value={filters.sort}
              onChange={(e) => setField('sort', e.target.value)}
            >
              <option value="newest">{t('pages.loads.sortNewest')}</option>
              <option value="capacity_desc">{t('loadsHub.sortCapacity')}</option>
              <option value="rate_asc">{t('loadsHub.sortRate')}</option>
            </select>
          </div>
          <div className="col-6 col-md-3 d-flex align-items-stretch">
            <Button variant="outline-secondary" size="sm" className="w-100" onClick={resetFilters}>
              {t('pages.loads.resetFilters')}
            </Button>
          </div>
        </div>
        {activeFilterBadges.length ? (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {activeFilterBadges.map((b) => (
              <span key={b.key} className="tp-filter-badge">
                {b.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {listError ? (
        <Card className="p-4 text-center">
          <p className="text-danger small mb-3">{listError}</p>
          <Button variant="outline-primary" size="sm" onClick={refresh}>
            {t('pages.admin.tryAgain')}
          </Button>
        </Card>
      ) : loading ? (
        <SkeletonCard rows={4} />
      ) : empty ? (
        <Card className="p-4 text-center text-muted small">{t('loadsHub.noCapacity')}</Card>
      ) : (
        <div className="row g-3">
          {listings.map((row) => (
            <div key={row.id} className="col-md-6 col-lg-4">
              <CarrierSpaceCard
                listing={row}
                onRequest={(l) => {
                  setRequestTarget(l);
                  setRequestTons('');
                }}
              />
            </div>
          ))}
        </div>
      )}

      {requestTarget ? (
        <div className="tp-overlay-dim position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3">
          <Card className="p-3 w-100 tp-max-w-modal-sm">
            <h6 className="mb-2">{t('loadsHub.requestCapacity')}</h6>
            <p className="small text-muted">
              {requestTarget.origin} → {requestTarget.destination}
            </p>
            <input
              type="number"
              className="form-control form-control-sm rounded-3 mb-3"
              min="0.1"
              step="0.1"
              max={kgToTons(requestTarget.remainingSpaceKg)}
              placeholder={t('loadsHub.remainingKgLabel')}
              value={requestTons}
              onChange={(e) => setRequestTons(e.target.value)}
            />
            <div className="d-flex gap-2">
              <Button variant="primary" className="flex-grow-1" onClick={submitRequest}>
                {t('loadsHub.sendRequest')}
              </Button>
              <Button variant="outline-secondary" onClick={() => setRequestTarget(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
};

export default CapacityMarketplace;
