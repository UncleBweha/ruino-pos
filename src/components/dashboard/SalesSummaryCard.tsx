import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/constants';
import { BarChart3 } from 'lucide-react';
import type { DashboardStats } from '@/types/database';

interface SalesSummaryCardProps {
  stats: DashboardStats;
  loading: boolean;
}

export function SalesSummaryCard({ stats, loading }: SalesSummaryCardProps) {
  const summaryItems = [
    { label: 'Total Sales', value: formatCurrency(stats.monthSales) },
    { label: 'This Month', value: formatCurrency(stats.monthProfit) },
    { label: 'Today', value: formatCurrency(stats.todaySales) },
  ];

  return (
    <Card className="border-0 bg-gradient-to-br from-accent/10 to-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          Sales
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {summaryItems.map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold currency mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
