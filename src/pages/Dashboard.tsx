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
  const { stats, topProducts, monthlySalesData, salesByPayment, loading, refresh } = useDashboard();
  const { lowStockProducts } = useProducts();
  const [showMonthlySales, setShowMonthlySales] = useState(false);

  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              Welcome, {firstName} 👋
            </h1>
            <p className="text-muted-foreground">Here's what's happening in your store.</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        <SalesOverviewCards
          stats={stats}
          loading={loading}
          onMonthSalesClick={() => setShowMonthlySales(true)}
        />

        {/* Charts Row: Line Chart + Sales Summary */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SalesChart data={monthlySalesData} loading={loading} />
          <SalesSummaryCard stats={stats} loading={loading} />
        </div>

        {/* Bottom Row: Pie Chart + Top Products + Low Stock */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <PaymentMethodChart data={salesByPayment} loading={loading} />
          <TopProductsCard products={topProducts} loading={loading} />
          <LowStockCard products={lowStockProducts} />
        </div>

        {/* User Management */}
        <div className="grid lg:grid-cols-3 gap-6">
          <UserManagement />
        </div>
      </div>

      <MonthlySalesDialog open={showMonthlySales} onOpenChange={setShowMonthlySales} />
    </AppLayout>
  );
}
