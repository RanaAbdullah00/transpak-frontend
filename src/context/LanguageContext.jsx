import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations.js';
import { clearRuntimeTranslationCache } from '../services/runtimeTranslation.js';

const STORAGE_KEY = 'transpak_lang';

export const LanguageContext = createContext(null);

// Language provider with a minimal t("scope.key") helper.
export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'ur' || stored === 'en') setLang(stored);
  }, []);

  useEffect(() => {
    const isUr = lang === 'ur';
    document.documentElement.lang = isUr ? 'ur-PK' : 'en';
    document.documentElement.dir = isUr ? 'rtl' : 'ltr';
    document.body.classList.toggle('tp-lang-ur', isUr);
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'ur' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      clearRuntimeTranslationCache();
      return next;
    });
  };

  const setLanguage = (next) => {
    const safe = next === 'ur' ? 'ur' : 'en';
    setLang(safe);
    localStorage.setItem(STORAGE_KEY, safe);
    clearRuntimeTranslationCache();
  };

  const t = useCallback((key, vars = {}) => {
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
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      isUrdu: lang === 'ur',
      t,
      toggleLanguage,
      setLanguage
    }),
    [lang, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

