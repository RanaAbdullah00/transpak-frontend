import React, { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import api from '../../services/api.js';
import { notifyError, notifySuccess } from '../../components/ui/ToastProvider.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { unwrapErrorMessage } from '../../utils/unwrapApi.js';

const Feedback = () => {
  const { t, isUrdu } = useLanguage();
  const [form, setForm] = useState({ subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      notifyError(t('pages.feedbackPage.required'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/notifications', {
        title: form.subject.trim().slice(0, 120),
        message: form.message.trim().slice(0, 2000),
        roleType: 'support',
        meta: { type: 'FEEDBACK' }
      });
      notifySuccess(t('pages.feedbackPage.success'));
      setForm({ subject: '', message: '' });
    } catch (err) {
      notifyError(unwrapErrorMessage(err) || t('pages.feedbackPage.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('pages.feedbackPage.title')}</h5>
      <Card className="p-3">
        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="form-label small" htmlFor="feedback-subject">
              {t('pages.feedbackPage.subject')}
            </label>
            <input
              id="feedback-subject"
              name="subject"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.feedbackPage.subjectPh')}
              value={form.subject}
              onChange={handleChange}
              autoComplete="off"
            />
          </div>
          <div className="mb-3">
            <label className="form-label small" htmlFor="feedback-message">
              {t('pages.feedbackPage.message')}
            </label>
            <textarea
              id="feedback-message"
              name="message"
              className="form-control form-control-sm rounded-3"
              placeholder={t('pages.feedbackPage.messagePh')}
              rows={4}
              value={form.message}
              onChange={handleChange}
            />
          </div>
          <Button
            variant="primary"
            className="w-100"
            type="submit"
            disabled={submitting || !form.subject.trim() || !form.message.trim()}
          >
            {submitting ? t('pages.feedbackPage.submitting') : t('pages.feedbackPage.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Feedback;
