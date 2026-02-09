import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { MonthlySalesData } from '@/hooks/useDashboard';
import { TrendingUp } from 'lucide-react';

interface SalesChartProps {
  data: MonthlySalesData[];
  loading: boolean;
}

export function SalesChart({ data, loading }: SalesChartProps) {
  if (loading) {
    return (
      <div className="bento-card col-span-full lg:col-span-2">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-[280px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bento-card col-span-full lg:col-span-2">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-accent-foreground" />
        </div>
        <div>
          <h3 className="font-bold text-base">Sales Overview</h3>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '16px',
              boxShadow: '0 8px 32px hsl(var(--foreground) / 0.08)',
              padding: '12px 16px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700, marginBottom: 4 }}
            formatter={(value: number) => [
              `Kshs ${value.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
            ]}
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '12px' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="sales"
            fill="hsl(var(--foreground))"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
            name="Sales"
          />
          <Bar
            dataKey="profit"
            fill="hsl(var(--accent))"
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
            name="Profit"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}