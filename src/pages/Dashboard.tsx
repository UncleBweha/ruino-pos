import { AppLayout } from '@/components/layout/AppLayout';
import { useDashboard } from '@/hooks/useDashboard';
import { useProducts } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/constants';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  CreditCard,
  Wallet,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { stats, topProducts, loading, refresh } = useDashboard();
  const { lowStockProducts } = useProducts();

  const statCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats.todaySales),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-pos-success',
    },
    {
      title: "Today's Profit",
      value: formatCurrency(stats.todayProfit),
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: "Month's Sales",
      value: formatCurrency(stats.monthSales),
      icon: BarChart3,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: "Month's Profit",
      value: formatCurrency(stats.monthProfit),
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total Products',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: stats.lowStockCount > 0 ? 'text-warning' : 'text-muted-foreground',
      bgColor: stats.lowStockCount > 0 ? 'bg-pos-warning' : 'bg-muted',
    },
    {
      title: 'Pending Credits',
      value: formatCurrency(stats.pendingCredits),
      icon: CreditCard,
      color: stats.pendingCredits > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: stats.pendingCredits > 0 ? 'bg-pos-danger' : 'bg-muted',
    },
    {
      title: "Today's Cash",
      value: formatCurrency(stats.todayCash),
      icon: Wallet,
      color: 'text-success',
      bgColor: 'bg-pos-success',
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Real-time business analytics</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="stat-card">
              <CardContent className="p-4">
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-xl lg:text-2xl font-bold currency">{stat.value}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : topProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No sales data yet
                </p>
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 5).map((product, index) => (
                    <div
                      key={product.product_name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium truncate max-w-[150px] lg:max-w-[200px]">
                            {product.product_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {product.total_quantity} units sold
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold currency">
                        {formatCurrency(product.total_revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  All products are well stocked
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-pos-warning"
                    >
                      <div>
                        <p className="font-medium truncate max-w-[180px]">
                          {product.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          SKU: {product.sku}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-warning">
                          {product.quantity} left
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Alert: {product.low_stock_alert}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
