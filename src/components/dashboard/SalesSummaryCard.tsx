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
    { label: 'Total Sales', value: formatCurrency(stats.monthSales), highlight: true },
    { label: 'This Month Profit', value: formatCurrency(stats.monthProfit) },
    { label: "Today's Revenue", value: formatCurrency(stats.todaySales) },
  ];

  return (
    <div className="bento-card-dark flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-white/80" />
        </div>
        <h3 className="font-bold text-base text-white/90">Sales Summary</h3>
      </div>
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16 bg-white/10" />
              <Skeleton className="h-7 w-24 bg-white/10" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {summaryItems.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-white/50">{item.label}</p>
              <p className={`text-xl font-extrabold currency mt-0.5 ${item.highlight ? 'text-accent' : 'text-white/90'}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {/* Decorative mustard bar */}
      <div className="mt-5 h-1.5 rounded-full bg-accent/80 w-2/3" />
    </div>
  );
}