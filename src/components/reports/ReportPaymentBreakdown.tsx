import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { DailyReportData } from '@/hooks/useReports';
import { PAYMENT_METHODS } from '@/lib/constants';

interface Props {
  report: DailyReportData;
  loading: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--warning))',
  'hsl(var(--info))',
  'hsl(var(--muted-foreground))',
];

const formatCurrency = (n: number) =>
  `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

const METHOD_LABELS: Record<string, string> = {};
PAYMENT_METHODS.forEach(m => { METHOD_LABELS[m.id] = m.label; });

export function ReportPaymentBreakdown({ report, loading }: Props) {
  const breakdown = report.paymentBreakdown || {};

  const data = Object.entries(breakdown)
    .map(([method, info]) => ({
      name: METHOD_LABELS[method] || method.charAt(0).toUpperCase() + method.slice(1),
      value: info.sales,
      count: info.count,
    }))
    .filter(d => d.value > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Payment Methods</CardTitle></CardHeader>
        <CardContent><div className="skeleton h-64 w-full rounded" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Methods</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center py-10">No sales data</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              <Legend
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t">
          {data.map(item => (
            <div key={item.name} className="text-center">
              <p className="text-xs text-muted-foreground">{item.name}</p>
              <p className="font-semibold text-sm currency">{formatCurrency(item.value)}</p>
              <p className="text-xs text-muted-foreground">{item.count} txns</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
