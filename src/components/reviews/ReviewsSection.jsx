import React, { useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Loader from '../ui/Loader.jsx';
import TranslatedText from '../ui/TranslatedText.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';

const ReviewsSection = ({ userId }) => {
  const { request, loading } = useApi();
  const { t } = useLanguage();
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ toUser: '', rating: 5, comment: '', loadId: '' });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const data = await request({ method: 'GET', url: `/reviews/${userId}` });
        setList(Array.isArray(data) ? data : []);
      } catch {
        setList([]);
      }
    })();
  }, [userId, request]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await request({
        method: 'POST',
        url: '/reviews',
        data: {
          toUser: form.toUser.trim(),
          rating: Number(form.rating),
          comment: form.comment.trim(),
          loadId: form.loadId.trim() || undefined
        }
      });
      notifySuccess(t('reviews.submittedToast'));
      setForm((f) => ({ ...f, comment: '', loadId: '' }));
      const data = await request({ method: 'GET', url: `/reviews/${userId}` });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('reviews.submitFailedToast') }));
    }
  };

  return (
    <div className="mt-4">
      <h6 className="mb-2">{t('reviews.formSectionTitle')}</h6>
      <Card className="p-3 mb-3">
        <div className="small text-muted mb-2">{t('reviews.formHint')}</div>
        <form onSubmit={submit} className="row g-2">
          <div className="col-md-4">
            <label className="form-label small mb-0">{t('reviews.revieweeLabel')}</label>
            <input
              className="form-control form-control-sm"
              value={form.toUser}
              onChange={(e) => setForm((f) => ({ ...f, toUser: e.target.value }))}
              placeholder={t('reviews.revieweePlaceholder')}
              required
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small mb-0 d-block">{t('reviews.ratingLabel')}</label>
            <div className="d-flex gap-1 flex-wrap tp-star-row" role="group" aria-label={t('reviews.starGroupAria')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`btn btn-sm tp-star-btn ${Number(form.rating) >= n ? 'tp-star-on' : 'btn-outline-secondary'}`}
                  onClick={() => setForm((f) => ({ ...f, rating: n }))}
                  aria-pressed={Number(form.rating) >= n}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-0">{t('reviews.loadIdOptionalLabel')}</label>
            <input
              className="form-control form-control-sm"
              value={form.loadId}
              onChange={(e) => setForm((f) => ({ ...f, loadId: e.target.value }))}
              placeholder={t('reviews.loadIdPlaceholder')}
            />
          </div>
          <div className="col-md-12">
            <label className="form-label small mb-0">{t('reviews.commentLabel')}</label>
            <textarea
              className="form-control form-control-sm"
              rows={2}
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              maxLength={500}
            />
          </div>
          <div className="col-12">
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {t('reviews.submitReview')}
            </Button>
          </div>
        </form>
      </Card>
      <Card className="p-0">
        {loading && !list.length ? (
          <div className="text-center py-4">
            <Loader />
          </div>
        ) : (
          <ul className="list-group list-group-flush small">
            {list.map((r) => (
              <li key={r.id} className="list-group-item d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-semibold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <div className="text-muted">
                    {r.comment ? <TranslatedText text={r.comment} /> : t('reviews.listCommentFallback')}
                  </div>
                </div>
                <div className="text-muted text-nowrap">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                </div>
              </li>
            ))}
            {!list.length && (
              <li className="list-group-item text-muted text-center py-4 tp-empty-state">
                <div className="fw-semibold mb-1">{t('reviews.listEmpty')}</div>
                <div className="small">{t('reviews.noReviewsBody')}</div>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default ReviewsSection;
