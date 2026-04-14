import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useDashboard } from '@/hooks/useDashboard';
import { useProducts } from '@/hooks/useProducts';
import { useExpenditures } from '@/hooks/useExpenditures';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/constants';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SalesOverviewCards } from '@/components/dashboard/SalesOverviewCards';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { PaymentMethodChart } from '@/components/dashboard/PaymentMethodChart';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockCard } from '@/components/dashboard/LowStockCard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { UserManagement } from '@/components/dashboard/UserManagement';
import { MonthlySalesDialog } from '@/components/dashboard/MonthlySalesDialog';
import { SyncStatusCard } from '@/components/dashboard/SyncStatusCard';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { stats, topProducts, monthlySalesData, salesByPayment, bestEmployee, loading, refresh } = useDashboard();
  const { lowStockProducts } = useProducts();
  const { getMonthlyExpenditure } = useExpenditures();
  const [showMonthlySales, setShowMonthlySales] = useState(false);

  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlyExpenditure = getMonthlyExpenditure(currentMonth);
  const netProfit = stats.monthProfit - monthlyExpenditure;

  return (
    <AppLayout>
      <div className="px-4 lg:px-8 space-y-6 max-w-[1400px] mx-auto">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
              Welcome, {firstName} 👋
            </h1>
            <p className="text-muted-foreground mt-1">Here's what's happening in your store today.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            className="rounded-full press-effect glass-panel border-border/50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stat Cards - Bento Grid */}
        <SalesOverviewCards
          stats={stats}
          loading={loading}
          bestEmployee={bestEmployee}
          onMonthSalesClick={() => setShowMonthlySales(true)}
        />

        {/* Profit Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Monthly Revenue</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(stats.monthSales)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Monthly Expenditure</p>
              <p className="text-xl font-bold mt-1 text-destructive">{formatCurrency(monthlyExpenditure)}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className={`text-xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {formatCurrency(netProfit)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row - Bento Layout */}
        <div className="grid lg:grid-cols-3 gap-5">
          <SalesChart data={monthlySalesData} loading={loading} />
          <SalesSummaryCard stats={stats} loading={loading} />
        </div>

        {/* Bottom Row: Pie Chart + Top Products + Low Stock */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <PaymentMethodChart data={salesByPayment} loading={loading} />
          <TopProductsCard products={topProducts} loading={loading} />
          <LowStockCard products={lowStockProducts} />
        </div>

        {/* User Management + Sync Status */}
        <div className="grid lg:grid-cols-3 gap-5">
          <UserManagement />
          <SyncStatusCard />
        </div>
      </div>

      <MonthlySalesDialog open={showMonthlySales} onOpenChange={setShowMonthlySales} />
    </AppLayout>
  );
}