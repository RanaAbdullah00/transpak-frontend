import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import Card from '../ui/Card.jsx';

// Simple line chart visualising shipment or revenue trends.
const AnalyticsChart = ({ data, label, legend = 'Series', emptyHint = 'Analytics will appear as activity grows.' }) => {
  const rows = Array.isArray(data) ? data : [];
  const hasData = rows.some((r) => Number(r?.value || 0) > 0);
  return (
    <Card>
      <h6 className="mb-2">{label}</h6>
      {!hasData ? (
        <div className="text-muted small tp-empty-state" style={{ height: 220, display: 'grid', placeItems: 'center' }}>
          <div className="text-center px-3">
            <div className="fw-semibold mb-1">No data yet</div>
            <div>{emptyHint}</div>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}`, legend]} />
              <Legend verticalAlign="top" height={28} formatter={() => legend} />
              <Line
                type="monotone"
                name={legend}
                dataKey="value"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 3, fill: '#16a34a' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

export default AnalyticsChart;

