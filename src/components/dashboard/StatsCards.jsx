import React from 'react';
import Card from '../ui/Card.jsx';

// Card grid showing key KPI metrics.
const StatsCards = ({ stats }) => (
  <div className="row g-2">
    {stats.map((item) => (
      <div key={item.label} className="col-6 col-md-3">
        <Card className="tp-stat-card text-center card-hover">
          <div className="small text-muted text-uppercase mb-1">
            {item.label}
          </div>
          <div className="h5 mb-0">{item.value}</div>
          {item.subLabel && (
            <div className="small text-muted mt-1">{item.subLabel}</div>
          )}
        </Card>
      </div>
    ))}
  </div>
);

export default StatsCards;

