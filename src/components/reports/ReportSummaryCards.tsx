import { DollarSign, TrendingUp, ShoppingCart, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { DailyReportData } from '@/hooks/useReports';

interface Props {
  report: DailyReportData;
  loading: boolean;
}

const formatCurrency = (n: number) =>
  `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function ReportSummaryCards({ report, loading }: Props) {
  const cards = [
    {
      label: "Total Sales",
      value: formatCurrency(report.totalSales),
      icon: DollarSign,
      accent: 'stat-primary',
    },
    {
      label: "Total Profit",
      value: formatCurrency(report.totalProfit),
      icon: TrendingUp,
      accent: 'stat-accent',
    },
    {
      label: "Transactions",
      value: report.totalTransactions.toString(),
      icon: ShoppingCart,
      accent: 'stat-success',
    },
    {
      label: "Avg Transaction",
      value: formatCurrency(report.avgTransactionValue),
      icon: BarChart3,
      accent: 'stat-warning',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className={`stat-card ${card.accent}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
              <card.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            {loading ? (
              <div className="skeleton h-7 w-24 rounded" />
            ) : (
              <p className="text-xl lg:text-2xl font-bold currency">{card.value}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
