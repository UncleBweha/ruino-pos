import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { SalesByPaymentMethod } from '@/hooks/useDashboard';

interface PaymentMethodChartProps {
  data: SalesByPaymentMethod[];
  loading: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--warning))',
  'hsl(var(--info))',
];

export function PaymentMethodChart({ data, loading }: PaymentMethodChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full rounded-full mx-auto max-w-[220px]" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sale Analytics</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <p className="text-muted-foreground text-sm">No sales data yet</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.method,
    value: d.count,
    percentage: total > 0 ? ((d.count / total) * 100).toFixed(0) : '0',
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Sale Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => [
                `${value} sales`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value: string, entry: any) => (
                <span className="text-xs text-muted-foreground">
                  {value} ({entry.payload?.percentage}%)
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
