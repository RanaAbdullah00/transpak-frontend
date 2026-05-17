import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage.js';
import LoadList from '../../components/loadboard/LoadList.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import Loader from '../../components/ui/Loader.jsx';
import { notifyError } from '../../components/ui/ToastProvider.jsx';
import { normalizeLoads } from '../../adapters/normalize.js';
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
  const [myBidLoadIds, setMyBidLoadIds] = useState(new Set());
  const debouncedFilters = useDebouncedValue(filters, 400);

  const { request, loading: apiLoading } = useApi();

  const fetchMyBids = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/bids/mine' });
      const ids = new Set(
        (Array.isArray(data) ? data : [])
          .filter((b) => ['pending', 'suggested', 'accepted'].includes(String(b.status || '').toLowerCase()))
          .map((b) => String(b.loadId))
      );
      setMyBidLoadIds(ids);
    } catch {
      setMyBidLoadIds(new Set());
    }
  }, [request]);

  useEffect(() => {
    fetchMyBids();
  }, [fetchMyBids]);

  useEffect(() => {
    const fetchAvailableLoads = async () => {
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
          }
        });
        const normalized = normalizeLoads(data);
        const filtered = normalized.filter((l) => !myBidLoadIds.has(String(l.id)));
        setLoads(filtered);
      } catch {
        notifyError(t('pages.loads.failedLoadDetail'));
        setLoads([]);
      }
    };
    fetchAvailableLoads();
  }, [debouncedFilters, request, myBidLoadIds, t]);

  const handleBid = (load) => {
    const activeRole = user?.activeRole ?? user?.roles?.[0];
    if (activeRole === 'carrier') return navigate('/bids/place', { state: { load } });
    return navigate(`/loads/${encodeURIComponent(load.id)}`);
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
            <input
              name="origin"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.loads.origin')}
              value={filters.origin}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6 col-md-3">
            <input
              name="destination"
              className="form-control form-control-sm rounded-3"
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
            <select
              name="vehicleType"
              className="form-select form-select-sm rounded-3"
              value={filters.vehicleType}
              onChange={handleFilterChange}
            >
              <option value="">{t('pages.loads.vehicleType')}</option>
              <option>Truck</option>
              <option>Trailer</option>
              <option>Container</option>
              <option>Flatbed</option>
            </select>
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
        <LoadList loads={loads} onBid={handleBid} />
      )}
    </div>
  );
};

export default React.memo(AvailableLoads);
