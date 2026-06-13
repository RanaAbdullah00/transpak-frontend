import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import { emitRealtimeRefresh } from '../../utils/spaceFlow.js';
import CitySelect from '../ui/CitySearchSelect.jsx';
import CarrierSpaceCard from './CarrierSpaceCard.jsx';
import { kgToTons, tonsToKg, ratePerKgToTon } from '../../utils/weightUnits.js';
import { isKnownCity, resolveCityName } from '../../data/pakistanCities.js';

const DEFAULT_FILTERS = {
  origin: '',
  destination: '',
  minCapacityTons: '',
  availableFrom: '',
  sort: 'newest'
};

function filterCityParam(value) {
  const resolved = resolveCityName(String(value || '').trim());
  return resolved && isKnownCity(resolved) ? resolved : undefined;
}

const CapacityMarketplace = ({ hubLayout = false, children = null }) => {
  const { t } = useLanguage();
  const { request, loading } = useApi();
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [listings, setListings] = useState([]);
  const [listError, setListError] = useState(null);
  const [requestTarget, setRequestTarget] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);
  const [requestTons, setRequestTons] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const debounced = useDebouncedValue(filters, 400);

  const refreshMarketplace = useCallback(async () => {
    setListError(null);
    try {
      const minTons = Number(debounced.minCapacityTons);
      const data = await request({
        method: 'GET',
        url: '/carrier-space',
        params: {
          origin: filterCityParam(debounced.origin),
          destination: filterCityParam(debounced.destination),
          minCapacityKg:
            Number.isFinite(minTons) && minTons > 0 ? tonsToKg(minTons) : undefined,
          availableFrom: debounced.availableFrom || undefined
        },
        skipGlobalErrorToast: true
      });
      let rows = Array.isArray(data) ? data : [];
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
    refreshMarketplace();
  }, [refreshMarketplace]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'space' && scope !== 'loads') return;
      refreshMarketplace();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => window.removeEventListener('tp:realtime-refresh', onRefresh);
  }, [refreshMarketplace]);

  const activeFilterBadges = useMemo(() => {
    const badges = [];
    if (filters.origin) badges.push({ key: 'origin', label: `${t('loadsHub.filterOrigin')}: ${filters.origin}` });
    if (filters.destination) {
      badges.push({ key: 'destination', label: `${t('loadsHub.filterDestination')}: ${filters.destination}` });
    }
    if (filters.minCapacityTons) {
      badges.push({ key: 'minCapacityTons', label: `≥ ${filters.minCapacityTons} t` });
    }
    if (filters.availableFrom) badges.push({ key: 'availableFrom', label: filters.availableFrom });
    return badges;
  }, [filters, t]);

  const empty = useMemo(() => !loading && !listError && listings.length === 0, [loading, listError, listings.length]);

  const setField = (name, value) => setFilters((prev) => ({ ...prev, [name]: value }));

  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const submitRequest = async () => {
    if (!requestTarget?.id) return;
    const tons = Number(requestTons);
    if (!Number.isFinite(tons) || tons <= 0) {
      notifyError(t('loadsHub.requestFailed'));
      return;
    }
    try {
      await request({
        method: 'POST',
        url: `/carrier-space/${requestTarget.id}/request`,
        data: { requestedKg: tonsToKg(tons), message: String(requestMessage || '').trim().slice(0, 500) }
      });
      notifySuccess(t('loadsHub.requestSent'));
      setRequestTarget(null);
      setRequestTons('');
      setRequestMessage('');
      refreshMarketplace();
      emitRealtimeRefresh('space');
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('loadsHub.requestFailed') }));
    }
  };

  const scrollToListings = () => {
    document.getElementById('tp-capacity-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filterBlock = (
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
              step="0.1"
              className="form-control form-control-sm rounded-3"
              placeholder={t('loadsHub.minCapacityKg')}
              value={filters.minCapacityTons}
              onChange={(e) => setField('minCapacityTons', e.target.value)}
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
  );

  const listingsBlock = (
    <div id="tp-capacity-listings">
      {listError ? (
        <Card className="p-4 text-center">
          <p className="text-danger small mb-3">
            <TranslatedText text={listError} as="span" />
          </p>
          <Button variant="outline-primary" size="sm" onClick={refreshMarketplace}>
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
                onViewDetails={setDetailsTarget}
                onRequest={(l) => {
                  setDetailsTarget(null);
                  setRequestTarget(l);
                  setRequestTons('');
                  setRequestMessage('');
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {filterBlock}
      {hubLayout ? (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <Button variant="primary" size="sm" onClick={scrollToListings}>
              {t('loadsHub.requestCapacity')}
            </Button>
          </div>
          {children}
        </>
      ) : null}
      {listingsBlock}

      <Modal
        open={Boolean(detailsTarget)}
        title={t('loadsHub.listingDetails')}
        onClose={() => setDetailsTarget(null)}
        size="sm"
      >
        {detailsTarget ? (
          <>
            <p className="fw-semibold mb-2">
              {detailsTarget.origin} → {detailsTarget.destination}
            </p>
            <ul className="small text-muted list-unstyled mb-3">
              <li>
                {t('loadsHub.remainingKgLabel')}: {kgToTons(detailsTarget.remainingSpaceKg)} t
              </li>
              {detailsTarget.availableFrom ? (
                <li>
                  {t('loadsHub.availableFrom')}: {String(detailsTarget.availableFrom).slice(0, 10)}
                </li>
              ) : null}
              {detailsTarget.ratePerKg != null ? (
                <li>
                  {t('loadsHub.ratePerKg', {
                    rate: Number(ratePerKgToTon(detailsTarget.ratePerKg)).toLocaleString()
                  })}
                </li>
              ) : null}
              {detailsTarget.notes ? <li className="text-break">{detailsTarget.notes}</li> : null}
            </ul>
            <p className="small text-body-secondary mb-3">{t('loadsHub.createFromCapacityHint')}</p>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant="primary"
                onClick={() => {
                  setRequestTarget(detailsTarget);
                  setDetailsTarget(null);
                  setRequestTons('');
                  setRequestMessage('');
                }}
              >
                {t('loadsHub.requestCapacity')}
              </Button>
              <Button variant="outline-secondary" onClick={() => setDetailsTarget(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(requestTarget)}
        title={t('loadsHub.requestCapacity')}
        onClose={() => {
          setRequestTarget(null);
          setRequestMessage('');
        }}
        size="sm"
      >
        {requestTarget ? (
          <>
            <p className="small text-muted">
              {requestTarget.origin} → {requestTarget.destination}
            </p>
            <p className="small text-body-secondary mb-2">{t('loadsHub.createFromCapacityHint')}</p>
            <input
              type="number"
              className="form-control form-control-sm rounded-3 mb-2"
              min="0.1"
              step="0.1"
              max={kgToTons(requestTarget.remainingSpaceKg)}
              placeholder={t('loadsHub.remainingKgLabel')}
              value={requestTons}
              onChange={(e) => setRequestTons(e.target.value)}
            />
            <textarea
              className="form-control form-control-sm rounded-3 mb-3"
              rows={2}
              maxLength={500}
              placeholder={t('loadsHub.requestNotesPlaceholder')}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
            />
            <div className="d-flex gap-2">
              <Button variant="primary" className="flex-grow-1" onClick={submitRequest}>
                {t('loadsHub.sendRequest')}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => {
                  setRequestTarget(null);
                  setRequestMessage('');
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
};

export default CapacityMarketplace;
