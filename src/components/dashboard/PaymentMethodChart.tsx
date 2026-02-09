import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { SalesByPaymentMethod } from '@/hooks/useDashboard';

interface PaymentMethodChartProps {
  data: SalesByPaymentMethod[];
  loading: boolean;
}

const COLORS = [
  'hsl(var(--foreground))',
  'hsl(var(--accent))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--info))',
];

export function PaymentMethodChart({ data, loading }: PaymentMethodChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (loading) {
    return (
      <div className="bento-card">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-[220px] w-full rounded-full mx-auto max-w-[220px]" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bento-card">
        <h3 className="font-bold text-base mb-2">Payment Methods</h3>
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-muted-foreground text-sm">No sales data yet</p>
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.method,
    value: d.count,
    percentage: total > 0 ? ((d.count / total) * 100).toFixed(0) : '0',
  }));

  return (
    <div className="bento-card">
      <h3 className="font-bold text-base mb-4">Payment Methods</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '16px',
              boxShadow: '0 8px 32px hsl(var(--foreground) / 0.08)',
            }}
            formatter={(value: number, name: string) => [
              `${value} sales`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground">
              {item.name} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}