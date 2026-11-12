'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function SubscriptionGrowthChart({
  growth,
}: {
  growth: Array<{ date: string; active: number; started: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={growth} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="activeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(5)}
            interval={Math.max(0, Math.ceil(growth.length / 6) - 1)}
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
          <Area
            type="monotone"
            dataKey="active"
            name="Active"
            stroke="#16a34a"
            strokeWidth={2}
            fill="url(#activeFill)"
          />
          <Line
            type="monotone"
            dataKey="started"
            name="Started"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
