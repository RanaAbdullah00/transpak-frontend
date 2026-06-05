import React from 'react';
import Card from '../ui/Card.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';
import TranslatedText from '../ui/TranslatedText.jsx';
import { sanitizeProductText } from '../../utils/userErrors.js';

// Stream of recent activity events.
const ActivityFeed = ({ activities }) => {
  const { t } = useLanguage();
  const list = Array.isArray(activities) ? activities : [];
  return (
    <Card>
      <h6 className="mb-2">{t('pages.activityFeed.title')}</h6>
      {list.length ? (
        <ul className="list-unstyled mb-0 small">
          {list.map((act) => (
            <li key={act.id} className="mb-2">
              <div>
                <TranslatedText text={sanitizeProductText(act.message) || t('pages.activityFeed.update')} />
              </div>
              <div className="text-muted">{act.time}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted small tp-empty-state">
          {t('pages.activityFeed.empty')}
          <div className="mt-1">{t('pages.activityFeed.emptySub')}</div>
        </div>
      )}
    </Card>
  );
};

export default ActivityFeed;
