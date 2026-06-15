import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import Loader from '../../components/ui/Loader.jsx';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { notifySystem, SystemNotifyType } from '../../utils/notifySystem.js';
import { formatUserError } from '../../utils/userErrors.js';
import { acceptLoadAtListedFare, submitCounterOffer, rejectLoadForCarrier } from '../../services/carrierLoadOffer.js';
import { commitOptimisticBidSuggest } from '../../utils/contractActivationLayer.js';
import { normalizeLoads } from '../../adapters/normalize.js';
import { ensureArray } from '../../utils/unwrapApi.js';
import VehicleTypeDropdown from '../../components/loadboard/VehicleTypeDropdown.jsx';
import CitySelect from '../../components/ui/CitySearchSelect.jsx';
import { filterOpenLoads } from '../../utils/loadBidding.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

const AvailableLoads = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [filters, setFilters] = useState({
    origin: '',
    destination: '',
    vehicleType: '',
    city: '',
    minPrice: '',
    maxPrice: '',
    minWeight: '',
    maxWeight: '',
    pickupFrom: '',
    pickupTo: '',
    sort: 'newest'
  });
  const [loads, setLoads] = useState([]);
  const [offerBusyId, setOfferBusyId] = useState(null);
  const debouncedFilters = useDebouncedValue(filters, 400);

  const { request, loading: apiLoading } = useApi();
  const activeRole = user?.activeRole ?? user?.roles?.[0];
  const isCarrier = activeRole === 'carrier';

  const fetchAvailableLoads = useCallback(async () => {
    try {
      const data = await request({
        method: 'GET',
        url: '/loads',
        params: {
          origin: debouncedFilters.origin || undefined,
          destination: debouncedFilters.destination || undefined,
          vehicleType: debouncedFilters.vehicleType || undefined,
          city: debouncedFilters.city || undefined,
          minPrice: debouncedFilters.minPrice || undefined,
          maxPrice: debouncedFilters.maxPrice || undefined,
          minWeight: debouncedFilters.minWeight || undefined,
          maxWeight: debouncedFilters.maxWeight || undefined,
          pickupFrom: debouncedFilters.pickupFrom || undefined,
          pickupTo: debouncedFilters.pickupTo || undefined,
          sort: debouncedFilters.sort || 'newest',
          limit: 60
        },
        skipGlobalErrorToast: true
      });
      setLoads(filterOpenLoads(normalizeLoads(ensureArray(data))));
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedLoadDetail') }));
      setLoads([]);
    }
  }, [debouncedFilters, request, t]);

  useEffect(() => {
    fetchAvailableLoads();
  }, [fetchAvailableLoads, activeRole]);

  useEffect(() => {
    const onRefresh = (e) => {
      const scope = e?.detail?.scope;
      if (scope && scope !== 'all' && scope !== 'loads' && scope !== 'bids') return;
      fetchAvailableLoads();
    };
    const onLoadBooked = (e) => {
      const loadId = e?.detail?.loadId;
      if (loadId) {
        setLoads((prev) => prev.filter((l) => String(l.id) !== String(loadId)));
      }
      fetchAvailableLoads();
    };
    window.addEventListener('tp:realtime-refresh', onRefresh);
    window.addEventListener('tp:load-booked', onLoadBooked);
    return () => {
      window.removeEventListener('tp:realtime-refresh', onRefresh);
      window.removeEventListener('tp:load-booked', onLoadBooked);
    };
  }, [fetchAvailableLoads]);

  const handleBid = (load) => {
    if (isCarrier) return;
    return navigate(`/loads/${encodeURIComponent(load.id)}`);
  };

  const handleCarrierAccept = async (load) => {
    setOfferBusyId(load.id);
    try {
      await acceptLoadAtListedFare(request, load, {
        t,
        notifyWarn: (msg) => notifySystem(SystemNotifyType.WARNING, msg)
      });
      notifySuccess(t('pages.loads.carrierAcceptSuccess'));
      await fetchAvailableLoads();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedLoadDetail') }));
    } finally {
      setOfferBusyId(null);
    }
  };

  const handleCarrierReject = async (load) => {
    setOfferBusyId(load.id);
    try {
      await rejectLoadForCarrier(request, load);
      notifySuccess(t('pages.loads.carrierRejectSuccess'));
      await fetchAvailableLoads();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedLoadDetail') }));
    } finally {
      setOfferBusyId(null);
    }
  };

  const handleCarrierCounter = async (load, amount) => {
    setOfferBusyId(load.id);
    try {
      const updated = await submitCounterOffer(request, load, amount, {
        t,
        notifyWarn: (msg) => notifySystem(SystemNotifyType.WARNING, msg)
      });
      if (updated?.id) {
        commitOptimisticBidSuggest(updated.id, amount, {
          suggestedBy: 'carrier',
          loadCode: load?.code
        });
      }
      notifySuccess(t('pages.loads.carrierCounterSuccess'));
      await fetchAvailableLoads();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('pages.loads.failedLoadDetail') }));
    } finally {
      setOfferBusyId(null);
    }
  };

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const wrapClass = embedded ? '' : 'container py-3';

  return (
    <div className={wrapClass}>
      {!embedded ? <h5 className="mb-3">{t('pages.loads.availableLoads')}</h5> : null}
      <div className="tp-filter-card mb-2">
        <div className="row g-2">
          <div className="col-6 col-md-3">
            <CitySelect
              name="origin"
              placeholder={t('pages.loads.origin')}
              value={filters.origin}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6 col-md-3">
            <CitySelect
              name="destination"
              placeholder={t('pages.loads.destination')}
              value={filters.destination}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6 col-md-3">
            <input
              name="pickupFrom"
              type="date"
              className="form-control form-control-sm rounded-3"
              aria-label={t('pages.loads.pickupFrom')}
              value={filters.pickupFrom}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6 col-md-3">
            <VehicleTypeDropdown
              name="vehicleType"
              value={filters.vehicleType}
              onChange={handleFilterChange}
              includeAllOption
            />
          </div>
          {!embedded ? (
            <>
              <div className="col-6 col-md-3">
                <input
                  name="pickupTo"
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  aria-label={t('pages.loads.pickupTo')}
                  value={filters.pickupTo}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="col-6 col-md-3">
                <input
                  name="minWeight"
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  placeholder={t('pages.loads.minWeight')}
                  value={filters.minWeight}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="col-6 col-md-3">
                <input
                  name="maxWeight"
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  placeholder={t('pages.loads.maxWeight')}
                  value={filters.maxWeight}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="col-6 col-md-3">
                <input
                  name="minPrice"
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  placeholder={t('pages.loads.minFare')}
                  value={filters.minPrice}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="col-6 col-md-3">
                <input
                  name="maxPrice"
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  placeholder={t('pages.loads.maxFare')}
                  value={filters.maxPrice}
                  onChange={handleFilterChange}
                />
              </div>
            </>
          ) : null}
          <div className="col-12 col-md-4">
            <select
              name="sort"
              className="form-select form-select-sm rounded-3"
              value={filters.sort}
              onChange={handleFilterChange}
            >
              <option value="newest">{t('pages.loads.sortNewest')}</option>
              <option value="price_asc">{t('pages.loads.sortPriceAsc')}</option>
              <option value="price_desc">{t('pages.loads.sortPriceDesc')}</option>
              <option value="weight_asc">{t('pages.loads.sortWeightAsc')}</option>
            </select>
          </div>
        </div>
      </div>
      {apiLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Loader />
        </div>
      ) : (
        <LoadList
          loads={loads}
          onBid={isCarrier ? undefined : handleBid}
          carrierMode={isCarrier}
          onCarrierAccept={handleCarrierAccept}
          onCarrierCounter={handleCarrierCounter}
          onCarrierReject={handleCarrierReject}
          carrierBusyLoadId={offerBusyId}
        />
      )}
    </div>
  );
};

export default React.memo(AvailableLoads);
