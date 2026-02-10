import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useDashboard } from '@/hooks/useDashboard';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SalesOverviewCards } from '@/components/dashboard/SalesOverviewCards';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { PaymentMethodChart } from '@/components/dashboard/PaymentMethodChart';
import { TopProductsCard } from '@/components/dashboard/TopProductsCard';
import { LowStockCard } from '@/components/dashboard/LowStockCard';
import { SalesSummaryCard } from '@/components/dashboard/SalesSummaryCard';
import { UserManagement } from '@/components/dashboard/UserManagement';
import { MonthlySalesDialog } from '@/components/dashboard/MonthlySalesDialog';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { stats, topProducts, monthlySalesData, salesByPayment, bestEmployee, loading, refresh } = useDashboard();
  const { lowStockProducts } = useProducts();
  const [showMonthlySales, setShowMonthlySales] = useState(false);

  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';

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

        {/* User Management */}
        <div className="grid lg:grid-cols-3 gap-5">
          <UserManagement />
        </div>
      </div>

      <MonthlySalesDialog open={showMonthlySales} onOpenChange={setShowMonthlySales} />
    </AppLayout>
  );
}