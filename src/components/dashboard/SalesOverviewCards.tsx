import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/constants';
import type { DashboardStats } from '@/types/database';
import type { BestEmployee } from '@/hooks/useDashboard';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  CreditCard,
  Wallet,
  DollarSign,
  ArrowUpRight,
  Trophy,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SalesOverviewCardsProps {
  stats: DashboardStats;
  loading: boolean;
  bestEmployee: BestEmployee | null;
  onMonthSalesClick: () => void;
}

export function SalesOverviewCards({ stats, loading, bestEmployee, onMonthSalesClick }: SalesOverviewCardsProps) {
  const navigate = useNavigate();

  const primaryCards = [
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.todaySales),
      icon: DollarSign,
      accent: 'bg-accent',
      accentText: 'text-accent-foreground',
    },
    {
      title: "Today's Profit",
      value: formatCurrency(stats.todayProfit),
      icon: TrendingUp,
      accent: 'bg-success',
      accentText: 'text-success-foreground',
    },
    {
      title: 'Products',
      value: stats.totalProducts.toString(),
      icon: Package,
      accent: 'bg-info',
      accentText: 'text-info-foreground',
      onClick: () => navigate('/inventory'),
    },
  ];

  const secondaryCards = [
    {
      title: "Month's Sales",
      value: formatCurrency(stats.monthSales),
      icon: TrendingUp,
      onClick: onMonthSalesClick,
    },
    {
      title: "Month's Profit",
      value: formatCurrency(stats.monthProfit),
      icon: TrendingUp,
    },
    {
      title: 'Low Stock',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      danger: stats.lowStockCount > 0,
      onClick: () => navigate('/inventory'),
    },
    {
      title: 'Pending Credits',
      value: formatCurrency(stats.pendingCredits),
      icon: CreditCard,
      danger: stats.pendingCredits > 0,
      onClick: () => navigate('/credits'),
    },
    {
      title: "Today's Cash",
      value: formatCurrency(stats.todayCash),
      icon: Wallet,
    },
    {
      title: 'Best Employee',
      value: bestEmployee?.name || '—',
      subValue: bestEmployee ? formatCurrency(bestEmployee.totalSales) : undefined,
      icon: Trophy,
      highlight: true,
    },
    {
      title: 'Inventory Cost',
      value: formatCurrency(stats.inventoryCost),
      icon: DollarSign,
      onClick: () => navigate('/inventory'),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Primary stat cards - big bento style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {primaryCards.map((card, i) => (
          <div
            key={i}
            className={cn(
              'bento-card relative overflow-hidden press-effect',
              card.onClick && 'cursor-pointer'
            )}
            onClick={card.onClick}
          >
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', card.accent)}>
                    <card.icon className={cn('w-5 h-5', card.accentText)} />
                  </div>
                  {card.onClick && (
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-2xl font-extrabold currency">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.title}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Secondary stat cards - compact bento */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryCards.map((card, i) => (
          <div
            key={i}
            className={cn(
              'bento-card !p-4 press-effect',
              card.onClick && 'cursor-pointer'
            )}
            onClick={card.onClick}
          >
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <card.icon className={cn('w-3.5 h-3.5', card.danger ? 'text-destructive' : 'text-muted-foreground')} />
                  <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                </div>
                <p className={cn('text-sm font-bold currency', card.danger && 'text-destructive')}>
                  {card.value}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}