import React, { useEffect, useMemo, useState } from 'react';
import StatsCards from '../../components/dashboard/StatsCards.jsx';
import ActivityFeed from '../../components/dashboard/ActivityFeed.jsx';
import AnalyticsChart from '../../components/dashboard/AnalyticsChart.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';

// High-level admin overview of platform metrics.
const AdminDashboard = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [statsRow, setStatsRow] = useState(null);
  const activities = [];
  const chartData = [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await request({ method: 'GET', url: '/admin/stats' });
        if (!cancelled) setStatsRow(data || null);
      } catch {
        if (!cancelled) setStatsRow(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  const stats = useMemo(() => {
    if (!statsRow) {
      return [
        { label: t('pages.adminDashboardPage.statUsers'), value: t('common.emDash') },
        { label: t('pages.adminDashboardPage.statLoads'), value: t('common.emDash') },
        { label: t('pages.adminDashboardPage.statBookings'), value: t('common.emDash') },
        { label: t('pages.adminDashboardPage.statActiveShipments'), value: t('common.emDash') }
      ];
    }
    return [
      { label: t('pages.adminDashboardPage.statUsers'), value: statsRow.totalUsers ?? 0 },
      { label: t('pages.adminDashboardPage.statLoads'), value: statsRow.totalLoads ?? 0 },
      { label: t('pages.adminDashboardPage.statBookings'), value: statsRow.totalBookings ?? 0 },
      { label: t('pages.adminDashboardPage.statActiveShipments'), value: statsRow.activeShipments ?? 0 }
    ];
  }, [statsRow, t]);

  return (
    <div className="container py-3">
      <h5 className="mb-3">{t('pages.adminDashboardPage.title')}</h5>
      <StatsCards stats={stats} />
      <div className="mt-3 row g-2">
        <div className="col-12 col-lg-6">
          <AnalyticsChart
            data={chartData}
            label={t('pages.adminDashboardPage.chartLabel')}
            emptyHint={t('pages.adminDashboardPage.chartEmpty')}
          />
        </div>
        <div className="col-12 col-lg-6">
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
