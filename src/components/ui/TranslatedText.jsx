import React from 'react';
import { useTranslatedValue } from '../../hooks/useRuntimeTranslation.js';

/** Renders backend-sourced copy with optional Urdu runtime translation (cached). */
const TranslatedText = ({ text, as: Tag = 'span', className, enabled = true }) => {
  const display = useTranslatedValue(text, { enabled });
  return <Tag className={className}>{display}</Tag>;
};

export default TranslatedText;
