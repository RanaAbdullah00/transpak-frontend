import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import SafeAvatar from '../ui/SafeAvatar.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { notifyError, notifySuccess } from '../ui/ToastProvider.jsx';
import { formatUserError } from '../../utils/userErrors.js';
import { invalidateRatingSummary } from '../../hooks/useReceivedRatingSummary.js';
import { emitRealtimeRefresh } from '../../utils/realtimeRefresh.js';

import StarPicker from './StarPicker.jsx';

const ReviewPromptModal = ({ prompt, onClose, onSubmitted }) => {
  const { t } = useLanguage();
  const { request } = useApi();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prompt) {
      setRating(5);
      setComment('');
    }
  }, [prompt]);

  if (!prompt) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        toUser: prompt.toUserId,
        rating: Number(rating),
        comment: comment.trim() || undefined
      };
      if (prompt.loadId) body.loadId = prompt.loadId;
      if (prompt.spaceRequestId) body.spaceRequestId = prompt.spaceRequestId;
      await request({ method: 'POST', url: '/reviews', data: body });
      notifySuccess(t('reviews.submittedToast'));
      invalidateRatingSummary(prompt.toUserId);
      emitRealtimeRefresh('all');
      onSubmitted?.(prompt);
      onClose();
    } catch (err) {
      notifyError(formatUserError(err, t, { fallback: t('reviews.submitFailedToast') }));
    } finally {
      setBusy(false);
    }
  };

  const title =
    prompt.kind === 'space' ? t('reviews.promptSpaceTitle') : t('reviews.promptShipmentTitle');

  return (
    <Modal open={Boolean(prompt)} title={title} onClose={onClose} size="sm" closeLabel={t('reviews.skipReview')}>
      <div className="d-flex align-items-center gap-3 mb-3 p-2 rounded-3 border bg-body-secondary bg-opacity-25">
        <div className="tp-avatar-sm rounded-circle overflow-hidden border flex-shrink-0">
          <SafeAvatar
            src={prompt.toUserAvatar || prompt.toAvatar}
            name={prompt.toUserName || prompt.label}
          />
        </div>
        <div className="min-w-0">
          <div className="fw-semibold small text-truncate">{prompt.toUserName || t('reviews.counterpartyRole')}</div>
          {prompt.toUserRole ? (
            <div className="small text-muted text-truncate">
              {prompt.toUserRole === 'carrier' ? t('auth.carrier') : t('auth.shipper')}
            </div>
          ) : null}
          {prompt.label && prompt.toUserName ? (
            <div className="small text-muted text-truncate">{prompt.label}</div>
          ) : null}
        </div>
      </div>
      <p className="small mb-3">{t('reviews.promptBody')}</p>
      <div className="mb-2">
        <span className="small fw-semibold d-block mb-1">{t('reviews.yourRating')}</span>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <label className="form-label small">{t('reviews.optionalComment')}</label>
      <textarea
        className="form-control form-control-sm mb-3"
        rows={3}
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={busy}
      />
      <div className="d-flex gap-2">
        <Button variant="primary" className="flex-grow-1" onClick={submit} disabled={busy}>
          {busy ? t('common.loading') : t('reviews.submitReview')}
        </Button>
        <Button variant="outline-secondary" onClick={onClose} disabled={busy}>
          {t('reviews.skipReview')}
        </Button>
      </div>
    </Modal>
  );
};

export default ReviewPromptModal;
