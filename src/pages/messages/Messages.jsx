import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaPaperclip } from 'react-icons/fa';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useLanguage } from '../../hooks/useLanguage.js';
import { AppContext } from '../../context/AppContext.jsx';
import * as chatApi from '../../services/chatApi.js';
import api from '../../services/api.js';
import { formatUserError } from '../../utils/userErrors.js';
import TranslatedText from '../../components/ui/TranslatedText.jsx';
import { translateRoleLabel } from '../../utils/i18nLabels.js';

const SEEN_DEBOUNCE_MS = 800;
const CHAT_FILE_PREVIEW = '__TP_FILE__';

/** Strict dedupe: API `id` (UUID) or clientMessageId. */
function chatMessageDedupeKey(m) {
  if (!m) return null;
  const mid = m._id ?? m.id;
  if (mid != null && String(mid).trim() !== '') return `id:${String(mid)}`;
  if (m.clientMessageId != null && String(m.clientMessageId).trim() !== '') {
    return `c:${String(m.clientMessageId)}`;
  }
  return null;
}

function threadPreviewFromMessage(msg) {
  if (msg?.body != null && String(msg.body).trim() !== '') return String(msg.body).trim().slice(0, 120);
  if (msg?.attachmentUrl) return CHAT_FILE_PREVIEW;
  return '';
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const Messages = () => {
  const { user } = useAuth();
  const { t, isUrdu } = useLanguage();
  const activeRole = user?.activeRole ?? user?.roles?.[0] ?? '';
  const uid = user?.id || user?._id;
  const app = useContext(AppContext);
  const getSocket = app?.getSocket;
  const registerChatMessageHandler = app?.registerChatMessageHandler;
  const registerChatSeenHandler = app?.registerChatSeenHandler;

  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [err, setErr] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newPeer, setNewPeer] = useState('');
  const [newLoad, setNewLoad] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef(null);
  const seenTimer = useRef(null);

  const mergeMessage = useCallback((convId, msg) => {
    if (!convId || !msg) return;
    const k = chatMessageDedupeKey(msg);
    if (!k) return;
    setMessagesByConv((prev) => {
      const list = prev[convId] || [];
      if (list.some((m) => chatMessageDedupeKey(m) === k)) return prev;
      return { ...prev, [convId]: [...list, msg] };
    });
  }, []);

  const loadThreads = useCallback(async () => {
    setLoadingList(true);
    setErr('');
    try {
      const rows = await chatApi.fetchConversations();
      const list = Array.isArray(rows) ? rows : [];
      setThreads(
        list.map((r) => ({
          ...r,
          lastPreview: r.lastPreview ?? r.lastMessage ?? ''
        }))
      );
    } catch (e) {
      setErr(formatUserError(e, t, { fallback: t('pages.messagesPage.loadConversationsFailed') }));
    } finally {
      setLoadingList(false);
    }
  }, [t]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoadingMsg(true);
    try {
      const rows = await chatApi.fetchMessages(convId, { limit: 80 });
      const raw = Array.isArray(rows) ? rows : [];
      const seen = new Set();
      const deduped = [];
      for (const m of raw) {
        const k = chatMessageDedupeKey(m);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        deduped.push(m);
      }
      setMessagesByConv((prev) => ({ ...prev, [convId]: deduped }));
    } catch {
      setMessagesByConv((prev) => ({ ...prev, [convId]: prev[convId] || [] }));
    } finally {
      setLoadingMsg(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const peer = searchParams.get('peer');
    const load = searchParams.get('load');
    if (!peer) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await chatApi.openConversation({
          peerUserId: peer,
          loadId: load || undefined
        });
        const cid = data?.conversationId ?? data?.id;
        if (cancelled || !cid) return;
        await loadThreads();
        setActiveId(cid);
        setSearchParams({}, { replace: true });
      } catch {
        // ignore invalid deep link
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, loadThreads]);

  useEffect(() => {
    if (!registerChatMessageHandler) return undefined;
    return registerChatMessageHandler((msg) => {
      const cid = msg?.conversationId;
      if (!cid) return;
      mergeMessage(cid, msg);
      const pv = threadPreviewFromMessage(msg);
      setThreads((prev) =>
        prev.map((th) =>
          th.id === cid ? { ...th, lastPreview: pv, lastMessageAt: msg.createdAt } : th
        )
      );
    });
  }, [registerChatMessageHandler, mergeMessage]);

  useEffect(() => {
    if (!registerChatSeenHandler) return undefined;
    return registerChatSeenHandler(() => {
      if (activeId) loadMessages(activeId);
    });
  }, [registerChatSeenHandler, activeId, loadMessages]);

  useEffect(() => {
    if (!activeId) return undefined;
    loadMessages(activeId);
    const s = getSocket?.();
    if (!s) return undefined;
    const join = () => {
      s.emit('chat:join', { conversationId: activeId }, () => {});
    };
    join();
    s.on('connect', join);
    return () => {
      s.off('connect', join);
    };
  }, [activeId, loadMessages, getSocket]);

  const scheduleSeen = useCallback(
    (convId) => {
      if (!convId || !getSocket) return;
      if (seenTimer.current) window.clearTimeout(seenTimer.current);
      seenTimer.current = window.setTimeout(() => {
        const list = messagesByConv[convId] || [];
        const last = list[list.length - 1];
        const lastId = last?._id ?? last?.id ?? null;
        const s = getSocket();
        if (s?.connected) {
          s.emit('chat:seen', { conversationId: convId, upToMessageId: lastId });
        }
        chatApi.markConversationReadHttp(convId, lastId).catch(() => {});
      }, SEEN_DEBOUNCE_MS);
    },
    [getSocket, messagesByConv]
  );

  useEffect(() => {
    if (activeId) scheduleSeen(activeId);
    return () => {
      if (seenTimer.current) window.clearTimeout(seenTimer.current);
    };
  }, [activeId, messagesByConv, scheduleSeen]);

  const active = useMemo(() => threads.find((x) => x.id === activeId), [threads, activeId]);
  const messages = activeId ? messagesByConv[activeId] || [] : [];

  const send = async (attachment) => {
    if (!activeId) return;
    const text = draft.trim();
    if (!text && !attachment) return;
    const prevDraft = draft;
    setDraft('');
    const clientMessageId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
      const msg = await chatApi.sendMessageHttp(activeId, {
        body: text,
        clientMessageId,
        attachment: attachment || undefined
      });
      mergeMessage(activeId, msg);
      const pv = threadPreviewFromMessage(msg);
      setThreads((prev) =>
        prev.map((th) =>
          th.id === activeId ? { ...th, lastPreview: pv, lastMessageAt: msg?.createdAt } : th
        )
      );
    } catch (e) {
      setDraft(prevDraft);
      setErr(formatUserError(e, t, { fallback: t('pages.messagesPage.sendFailed') }));
    }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeId) return;
    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      setErr(t('pages.messagesPage.uploadFailed'));
      return;
    }
    const isPdf = file.type === 'application/pdf';
    const isImg = String(file.type || '').startsWith('image/');
    if (!isPdf && !isImg) {
      setErr(t('pages.messagesPage.uploadFailed'));
      return;
    }
    setUploading(true);
    setUploadPct(0);
    setErr('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const path = isPdf ? '/upload/document' : '/upload/image';
      const res = await api.post(path, formData, {
        onUploadProgress: (ev) => {
          if (ev.total) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
        }
      });
      const data = res.data;
      await send({
        url: data.url,
        publicId: data.publicId,
        kind: isPdf ? 'pdf' : 'image',
        fileName: file.name
      });
    } catch (ex) {
      setErr(formatUserError(ex, t, { fallback: t('pages.messagesPage.uploadFailed') }));
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const openNew = async () => {
    setErr('');
    if (!newPeer.trim()) return;
    try {
      const data = await chatApi.openConversation({
        peerUserId: newPeer.trim(),
        loadId: newLoad.trim() || undefined
      });
      const cid = data?.conversationId ?? data?.id;
      setShowNew(false);
      setNewPeer('');
      setNewLoad('');
      await loadThreads();
      if (cid) setActiveId(cid);
    } catch (e) {
      setErr(formatUserError(e, t, { fallback: t('pages.messagesPage.openChatFailed') }));
    }
  };

  const renderPreviewLine = (preview) => {
    if (!preview) return t('common.emDash');
    if (preview === CHAT_FILE_PREVIEW) return t('pages.messagesPage.attachmentLabel');
    return <TranslatedText text={preview} />;
  };

  return (
    <div className={`container py-3 ${isUrdu ? 'tp-rtl' : ''}`}>
      <h5 className="mb-3">{t('common.messages')}</h5>
      {err ? (
        <div className="alert alert-warning py-2 small mb-2">
          <TranslatedText text={err} as="span" />
        </div>
      ) : null}

      <div className="row g-2">
        <div className="col-12 col-lg-4">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">{t('common.messages')}</h6>
              <Button variant="outline-primary" className="btn-sm" type="button" onClick={() => setShowNew(true)}>
                {t('pages.messagesPage.newButton')}
              </Button>
            </div>
            {loadingList ? (
              <div className="small text-muted">{t('pages.messagesPage.loadingList')}</div>
            ) : threads.length === 0 ? (
              <div className="small text-muted">{t('pages.messagesPage.emptyList')}</div>
            ) : (
              <div className="list-group list-group-flush">
                {threads.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    className={`list-group-item list-group-item-action border-0 px-0 ${
                      th.id === activeId ? 'fw-semibold' : ''
                    }`}
                    onClick={() => setActiveId(th.id)}
                  >
                    <div className="d-flex justify-content-between">
                      <span>{th.peerName || t('common.userFallback')}</span>
                      <small className="text-muted">{formatTime(th.lastMessageAt)}</small>
                    </div>
                    <div className="small text-muted text-truncate">{renderPreviewLine(th.lastPreview)}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-12 col-lg-8">
          <Card>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <div className="fw-semibold">{active?.peerName || (activeId ? '…' : t('common.emDash'))}</div>
                <div className="small text-muted">{translateRoleLabel(t, activeRole)}</div>
              </div>
            </div>

            {!activeId ? (
              <div className="small text-muted py-4 text-center">{t('pages.messagesPage.selectConversation')}</div>
            ) : (
              <>
                <div className="tp-chat-box rounded-4 p-2 mb-2" style={{ minHeight: 220 }}>
                  {loadingMsg && messages.length === 0 ? (
                    <div className="small text-muted p-2">{t('pages.messagesPage.loadingThread')}</div>
                  ) : null}
                  {messages.map((m) => {
                    const mine = String(m.senderId) === String(uid);
                    const rowKey =
                      chatMessageDedupeKey(m) ||
                      `f-${m.createdAt || ''}-${m.senderId || ''}-${String(m.body || '').slice(0, 12)}`;
                    return (
                      <div
                        key={rowKey}
                        className={`d-flex mb-2 ${mine ? 'justify-content-end' : 'justify-content-start'}`}
                      >
                        <div className={`tp-chat-bubble ${mine ? 'me' : 'them'}`}>
                          {m.attachmentUrl && m.attachmentKind === 'image' ? (
                            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="d-block mb-1">
                              <img
                                src={m.attachmentUrl}
                                alt=""
                                className="img-fluid rounded-3"
                                style={{ maxHeight: 220, maxWidth: '100%' }}
                              />
                            </a>
                          ) : null}
                          {m.attachmentUrl && m.attachmentKind === 'pdf' ? (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="small fw-semibold d-block mb-1"
                            >
                              {m.attachmentFileName || t('pages.messagesPage.pdfDocument')}
                            </a>
                          ) : null}
                          {m.body != null && String(m.body).trim() !== '' ? (
                            <div className="small">
                              <TranslatedText text={m.body} />
                            </div>
                          ) : null}
                          <div className="tp-chat-time d-flex align-items-center gap-1">
                            <span>{formatTime(m.createdAt)}</span>
                            {mine && m.seenByPeer ? (
                              <span title={t('notifications.seen')}>✓✓</span>
                            ) : mine ? (
                              <span>✓</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="d-none"
                  onChange={onPickFile}
                />
                {uploading ? (
                  <div className="small text-muted mb-2">
                    {t('pages.messagesPage.uploadingPct', { pct: uploadPct })}
                  </div>
                ) : null}
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill"
                    disabled={uploading}
                    aria-label={t('pages.messagesPage.attachImage')}
                    title={t('pages.messagesPage.attachImage')}
                    onClick={() => fileRef.current?.click()}
                  >
                    <FaPaperclip />
                  </button>
                  <input
                    className={`form-control form-control-sm rounded-pill flex-grow-1 ${isUrdu ? 'text-end' : ''}`}
                    placeholder={t('pages.messagesPage.typeMessage')}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Button variant="primary" className="btn-sm px-3" type="button" disabled={uploading} onClick={() => send()}>
                    {t('pages.messagesPage.send')}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {showNew ? (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title">{t('pages.messagesPage.newChat')}</h6>
                <button
                  type="button"
                  className="btn-close"
                  aria-label={t('common.close')}
                  onClick={() => setShowNew(false)}
                />
              </div>
              <div className="modal-body">
                <label className="form-label small">{t('pages.messagesPage.peerIdLabel')}</label>
                <input
                  className="form-control form-control-sm mb-2"
                  value={newPeer}
                  onChange={(e) => setNewPeer(e.target.value)}
                  placeholder={t('pages.messagesPage.peerIdPlaceholder')}
                />
                <label className="form-label small">{t('pages.messagesPage.loadIdOptional')}</label>
                <input
                  className="form-control form-control-sm"
                  value={newLoad}
                  onChange={(e) => setNewLoad(e.target.value)}
                />
              </div>
              <div className="modal-footer py-2">
                <Button variant="secondary" className="btn-sm" type="button" onClick={() => setShowNew(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="primary" className="btn-sm" type="button" onClick={openNew}>
                  {t('pages.messagesPage.open')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Messages;
