import React from 'react';
import Badge from '../ui/Badge.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import { lifecycleBadgeVariant, normalizeLifecycleStage } from '../../utils/logisticsLifecycle.js';

const LifecycleBadge = ({ stage, size }) => {
  const { t } = useLanguage();
  const canon = normalizeLifecycleStage(stage) || 'created';
  const key = `lifecycle.${canon}`;
  const label = t(key);
  const variant = lifecycleBadgeVariant(canon);
  const cls = size === 'lg' ? 'fs-6 px-3 py-2' : '';
  return (
    <Badge variant={variant} className={cls}>
      {label !== key ? label : canon.replace(/_/g, ' ')}
    </Badge>
  );
};

export default LifecycleBadge;
