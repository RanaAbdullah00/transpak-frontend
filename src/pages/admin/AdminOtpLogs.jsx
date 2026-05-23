import React, { useEffect, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { formatUserError } from '../../utils/userErrors.js';

const AdminOtpLogs = () => {
  const { request } = useApi();
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (q = '') => {
    try {
      setLoading(true);
      setError(null);
      const url = q.trim() ? `/admin/otp-logs?email=${encodeURIComponent(q.trim())}` : '/admin/otp-logs';
      const data = await request({ url });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(formatUserError(e, t, { fallback: t('pages.admin.otpLoadFailed') }));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [request, t]);

  return (
    <div className="container py-3">
      <h5 className="mb-2">{t('pages.admin.otpLogsTitle')}</h5>
      <p className="small text-muted mb-3">{t('pages.admin.otpLogsLead')}</p>
      <form
        className="row g-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          load(email);
        }}
      >
        <div className="col-sm-8 col-md-6">
          <input
            type="email"
            className="form-control form-control-sm rounded-3"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-primary btn-sm rounded-lg px-3">
            {t('pages.admin.otpSearch')}
          </button>
        </div>
      </form>
      {error && <div className="alert alert-warning rounded-3">{error}</div>}
      {loading ? (
        <SkeletonTable cols={5} rows={6} />
      ) : (
        <Card className="p-0 overflow-hidden border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">{t('auth.email')}</th>
                  <th>{t('pages.admin.otpPurpose')}</th>
                  <th>{t('pages.admin.otpAttempts')}</th>
                  <th>{t('pages.admin.otpConsumed')}</th>
                  <th className="pe-3">{t('pages.admin.tableCreated')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="ps-3 small">{r.email}</td>
                    <td className="small">{r.purpose}</td>
                    <td className="small">{r.attemptCount ?? 0}</td>
                    <td className="small">{r.consumedAt ? t('pages.admin.yes') : t('pages.admin.no')}</td>
                    <td className="pe-3 small text-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminOtpLogs;
