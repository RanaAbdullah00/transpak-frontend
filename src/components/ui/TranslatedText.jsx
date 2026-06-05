import React from 'react';
import { useTranslatedValue } from '../../hooks/useRuntimeTranslation.js';
import { sanitizeProductText } from '../../utils/userErrors.js';

/** Renders backend-sourced copy with optional Urdu runtime translation (cached). */
const TranslatedText = ({ text, as: Tag = 'span', className, enabled = true }) => {
  const safe = sanitizeProductText(text);
  const display = useTranslatedValue(safe, { enabled });
  if (!display) return null;
  return <Tag className={className}>{display}</Tag>;
};

export default TranslatedText;
