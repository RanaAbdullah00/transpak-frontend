import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from './useLanguage.js';
import { translateDynamicText } from '../services/runtimeTranslation.js';
import { scriptHint, uiTargetLang } from '../utils/scriptHint.js';

/**
 * Backend-proxied translation; `targetLang` defaults to current UI language (en ↔ ur).
 */
export function useRuntimeTranslation() {
  const { lang } = useLanguage();

  const translate = useCallback(
    (text, opts = {}) => translateDynamicText(text, opts.targetLang ?? uiTargetLang(lang)),
    [lang]
  );

  return { translate, lang };
}

/**
 * Shows DB/API text in the active UI language: Urdu script → English when UI is EN,
 * Latin (etc.) → Urdu when UI is UR. Skips network when script already matches UI.
 */
export function useTranslatedValue(text, { enabled = true } = {}) {
  const { lang } = useLanguage();
  const [display, setDisplay] = useState(() => String(text ?? ''));
  const gen = useRef(0);

  useEffect(() => {
    const raw = String(text ?? '');
    gen.current += 1;
    const myGen = gen.current;
    const target = uiTargetLang(lang);

    if (!enabled || !raw.trim()) {
      setDisplay(raw);
      return undefined;
    }

    if (scriptHint(raw) === target) {
      setDisplay(raw);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const out = await translateDynamicText(raw, target);
      if (!cancelled && myGen === gen.current) setDisplay(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [text, lang, enabled]);

  return display;
}
