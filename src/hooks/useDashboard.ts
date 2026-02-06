import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardStats, TopProduct } from '@/types/database';

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayProfit: 0,
    monthSales: 0,
    monthProfit: 0,
    totalProducts: 0,
    lowStockCount: 0,
    pendingCredits: 0,
    todayCash: 0,
    inventoryCost: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Run ALL queries in parallel for maximum speed
      const [
        { data: todaySales },
        { data: monthSales },
        { count: totalProducts },
        { data: products },
        { data: credits },
        { data: cashBox },
        { data: saleItems },
      ] = await Promise.all([
        supabase
          .from('sales')
          .select('total, profit')
          .gte('created_at', startOfDay.toISOString())
          .neq('status', 'voided'),
        supabase
          .from('sales')
          .select('total, profit')
          .gte('created_at', startOfMonth.toISOString())
          .neq('status', 'voided'),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('products')
          .select('quantity, low_stock_alert, buying_price'),
        supabase
          .from('credits')
          .select('balance')
          .eq('status', 'pending'),
        supabase
          .from('cash_box')
          .select('amount')
          .gte('created_at', startOfDay.toISOString()),
        supabase
          .from('sale_items')
          .select('product_name, quantity, total')
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      const lowStockCount = products?.filter(
        (p) => p.quantity <= p.low_stock_alert
      ).length || 0;

      const inventoryCost = products?.reduce(
        (sum, p) => sum + (p.quantity * Number(p.buying_price)), 0
      ) || 0;

      const pendingCredits = credits?.reduce((sum, c) => sum + Number(c.balance), 0) || 0;
      const todayCash = cashBox?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      // Aggregate top products
      const productAggregates: Record<string, { quantity: number; revenue: number }> = {};
      saleItems?.forEach((item) => {
        if (!productAggregates[item.product_name]) {
          productAggregates[item.product_name] = { quantity: 0, revenue: 0 };
        }
        productAggregates[item.product_name].quantity += item.quantity;
        productAggregates[item.product_name].revenue += Number(item.total);
      });

      const topProductsData: TopProduct[] = Object.entries(productAggregates)
        .map(([name, data]) => ({
          product_name: name,
          total_quantity: data.quantity,
          total_revenue: data.revenue,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      setStats({
        todaySales: todaySales?.reduce((sum, s) => sum + Number(s.total), 0) || 0,
        todayProfit: todaySales?.reduce((sum, s) => sum + Number(s.profit), 0) || 0,
        monthSales: monthSales?.reduce((sum, s) => sum + Number(s.total), 0) || 0,
        monthProfit: monthSales?.reduce((sum, s) => sum + Number(s.profit), 0) || 0,
        totalProducts: totalProducts || 0,
        lowStockCount,
        pendingCredits,
        todayCash,
        inventoryCost,
      });

      setTopProducts(topProductsData);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Set up realtime subscriptions for auto-updates
    const salesChannel = supabase
      .channel('dashboard-sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchDashboardData)
      .subscribe();

    const productsChannel = supabase
      .channel('dashboard-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchDashboardData)
      .subscribe();

    const creditsChannel = supabase
      .channel('dashboard-credits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credits' }, fetchDashboardData)
      .subscribe();

    const cashChannel = supabase
      .channel('dashboard-cash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_box' }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(creditsChannel);
      supabase.removeChannel(cashChannel);
    };
  }, [fetchDashboardData]);

  return {
    stats,
    topProducts,
    loading,
    refresh: fetchDashboardData,
  };
}
