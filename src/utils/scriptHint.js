/** Rough script detection aligned with backend translation service. */
export function scriptHint(text) {
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(text || ''))) {
    return 'ur';
  }
  return 'en';
}

export function uiTargetLang(lang) {
  return lang === 'ur' ? 'ur' : 'en';
}
