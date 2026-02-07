import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/constants';
import type { DashboardStats } from '@/types/database';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  CreditCard,
  Wallet,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SalesOverviewCardsProps {
  stats: DashboardStats;
  loading: boolean;
  onMonthSalesClick: () => void;
}

export function SalesOverviewCards({ stats, loading, onMonthSalesClick }: SalesOverviewCardsProps) {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'Total Revenue',
      subtitle: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      icon: DollarSign,
      gradient: 'from-primary/15 to-primary/5',
      iconBg: 'bg-primary/20',
      iconColor: 'text-primary',
    },
    {
      title: 'Total Profit',
      subtitle: "Today's Profit",
      value: formatCurrency(stats.todayProfit),
      icon: TrendingUp,
      gradient: 'from-success/15 to-success/5',
      iconBg: 'bg-success/20',
      iconColor: 'text-success',
    },
    {
      title: 'Products',
      subtitle: 'Total Inventory',
      value: stats.totalProducts.toString(),
      icon: Package,
      gradient: 'from-info/15 to-info/5',
      iconBg: 'bg-info/20',
      iconColor: 'text-info',
      onClick: () => navigate('/inventory'),
    },
  ];

  const secondaryCards = [
    {
      title: "Month's Sales",
      value: formatCurrency(stats.monthSales),
      icon: TrendingUp,
      color: 'text-info',
      onClick: onMonthSalesClick,
    },
    {
      title: "Month's Profit",
      value: formatCurrency(stats.monthProfit),
      icon: TrendingUp,
      color: 'text-success',
    },
    {
      title: 'Low Stock',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: stats.lowStockCount > 0 ? 'text-warning' : 'text-muted-foreground',
      onClick: () => navigate('/inventory'),
    },
    {
      title: 'Pending Credits',
      value: formatCurrency(stats.pendingCredits),
      icon: CreditCard,
      color: stats.pendingCredits > 0 ? 'text-destructive' : 'text-muted-foreground',
      onClick: () => navigate('/credits'),
    },
    {
      title: "Today's Cash",
      value: formatCurrency(stats.todayCash),
      icon: Wallet,
      color: 'text-success',
    },
    {
      title: 'Inventory Cost',
      value: formatCurrency(stats.inventoryCost),
      icon: DollarSign,
      color: 'text-info',
      onClick: () => navigate('/inventory'),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <Card
            key={i}
            className={cn(
              'overflow-hidden transition-all hover:shadow-md border-0',
              card.onClick && 'cursor-pointer'
            )}
            onClick={card.onClick}
          >
            <CardContent className={cn('p-5 bg-gradient-to-br', card.gradient)}>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ) : (
                <>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', card.iconBg)}>
                    <card.icon className={cn('w-5 h-5', card.iconColor)} />
                  </div>
                  <p className="text-2xl font-bold currency">{card.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryCards.map((card, i) => (
          <Card
            key={i}
            className={cn(
              'transition-all hover:shadow-sm',
              card.onClick && 'cursor-pointer hover:ring-1 hover:ring-primary/30'
            )}
            onClick={card.onClick}
          >
            <CardContent className="p-3">
              {loading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-1">
                    <card.icon className={cn('w-3.5 h-3.5', card.color)} />
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                  </div>
                  <p className="text-sm font-bold currency">{card.value}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
