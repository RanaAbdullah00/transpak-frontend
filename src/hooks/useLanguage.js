import { useCallback, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { LanguageContext } from '../context/LanguageContext.jsx';
import { translations } from '../i18n/translations.js';
import { useAuth } from './useAuth.js';
import { resolveAdminShell } from '../utils/rbac.js';

function buildT(lang) {
  return (key, vars = {}) => {
    const parts = String(key).split('.').filter(Boolean);
    const walk = (locale) => {
      let cur = translations?.[locale];
      for (const p of parts) {
        cur = cur?.[p];
        if (cur == null) return null;
      }
      return cur;
    };
    let cur = walk(lang);
    if ((cur == null || typeof cur === 'object') && lang !== 'en') {
      cur = walk('en');
    }
    if (cur == null) return String(key);
    if (typeof cur === 'object') return String(key);
    if (typeof cur !== 'string') return cur;
    return cur.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{{${k}}}`));
  };
}

const adminT = buildT('en');

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  const { user } = useAuth();
  const location = useLocation();
  const adminShell = resolveAdminShell(user, location.pathname);

  const t = useCallback(
    (key, vars) => (adminShell ? adminT(key, vars) : ctx?.t?.(key, vars) ?? String(key)),
    [adminShell, ctx]
  );

  return useMemo(
    () => ({
      lang: adminShell ? 'en' : ctx?.lang ?? 'en',
      isUrdu: adminShell ? false : Boolean(ctx?.isUrdu),
      t,
      toggleLanguage: adminShell ? () => {} : ctx?.toggleLanguage ?? (() => {}),
      setLanguage: adminShell ? () => {} : ctx?.setLanguage ?? (() => {})
    }),
    [adminShell, ctx, t]
  );
};
