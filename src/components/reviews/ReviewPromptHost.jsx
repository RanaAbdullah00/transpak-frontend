import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useApi } from '../../hooks/useApi.js';
import { shouldUseAdminShell } from '../../utils/rbac.js';
import ReviewPromptModal from './ReviewPromptModal.jsx';

const STORAGE_KEY = 'tp_review_dismissed';

function loadDismissed() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

const ReviewPromptHost = () => {
  const { user } = useAuth();
  const { request } = useApi();
  const [prompt, setPrompt] = useState(null);
  const dismissedRef = useRef(loadDismissed());
  const queueRef = useRef([]);

  const dismissKey = (p) =>
    p?.kind === 'space'
      ? `space:${p.spaceRequestId}`
      : p?.loadId
      ? `load:${p.loadId}`
      : null;

  const showNext = useCallback(() => {
    while (queueRef.current.length) {
      const next = queueRef.current.shift();
      const key = dismissKey(next);
      if (key && dismissedRef.current.has(key)) continue;
      setPrompt(next);
      return;
    }
    setPrompt(null);
  }, []);

  const enqueue = useCallback(
    (items) => {
      const list = Array.isArray(items) ? items : [items];
      for (const item of list) {
        if (!item?.toUserId) continue;
        const key = dismissKey(item);
        if (key && dismissedRef.current.has(key)) continue;
        if (queueRef.current.some((q) => dismissKey(q) === key) || dismissKey(prompt) === key) continue;
        queueRef.current.push(item);
      }
      if (!prompt) showNext();
    },
    [prompt, showNext]
  );

  const fetchPending = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await request({ method: 'GET', url: '/reviews/pending' });
      if (Array.isArray(data) && data.length) enqueue(data);
    } catch {
      /* optional endpoint */
    }
  }, [user?.id, request, enqueue]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    const onPrompt = (e) => {
      if (e?.detail) enqueue(e.detail);
    };
    const onRefresh = () => fetchPending();
    window.addEventListener('tp:review-prompt', onPrompt);
    window.addEventListener('tp:realtime-refresh', onRefresh);
    return () => {
      window.removeEventListener('tp:review-prompt', onPrompt);
      window.removeEventListener('tp:realtime-refresh', onRefresh);
    };
  }, [enqueue, fetchPending]);

  const handleClose = () => {
    const key = dismissKey(prompt);
    if (key) {
      dismissedRef.current.add(key);
      saveDismissed(dismissedRef.current);
    }
    setPrompt(null);
    setTimeout(showNext, 300);
  };

  const handleSubmitted = (p) => {
    const key = dismissKey(p);
    if (key) {
      dismissedRef.current.add(key);
      saveDismissed(dismissedRef.current);
    }
  };

  if (shouldUseAdminShell(user)) return null;

  return <ReviewPromptModal prompt={prompt} onClose={handleClose} onSubmitted={handleSubmitted} />;
};

export default ReviewPromptHost;
