import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../../components/ui/TranslatedText.jsx';
import { sanitizeProductText } from '../../utils/userErrors.js';
import { FaHistory } from 'react-icons/fa';

const OperationsActivity = () => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);

  const refresh = useCallback(async () => {
    const data = await request({
      url: '/operations/activity',
      params: { since: '7d', limit: 50 },
      skipGlobalErrorToast: true
    }).catch(() => []);
    setRows(Array.isArray(data) ? data : []);
  }, [request]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">{t('pages.activityFeed.title')}</h5>
        <Link to="/dashboard" className="small">
          {t('common.back')}
        </Link>
      </div>
      {loading ? (
        <>
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </>
      ) : rows.length ? (
        <Card>
          <ul className="list-unstyled mb-0 small">
            {rows.map((act) => (
              <li key={act.id} className="mb-3 pb-2 border-bottom">
                <div>
                  <TranslatedText
                    text={sanitizeProductText(act.message || act.title) || t('pages.activityFeed.update')}
                  />
                </div>
                <div className="text-muted">
                  {act.createdAt ? new Date(act.createdAt).toLocaleString() : ''}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={FaHistory} title={t('pages.activityFeed.empty')} body={t('pages.activityFeed.emptySub')} />
      )}
    </div>
  );
};

export default OperationsActivity;
