'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function CreditConsumptionChart({
  series,
}: {
  series: Array<{ date: string; granted: number; consumed: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(5)}
            interval={Math.max(0, Math.ceil(series.length / 6) - 1)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            width={42}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              borderColor: '#e2e8f0',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
            labelFormatter={(label) => `Day ${label}`}
          />
          <Line
            type="monotone"
            dataKey="consumed"
            name="Consumed"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="granted"
            name="Granted"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
